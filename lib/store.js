import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { createInitialState, BOARD_CELLS } from "./gameData";

// "Core" is everything the live UI actually polls for — board, teams,
// timer, roster, curses, prompts. It stays roughly constant-sized all
// party long. The narrative log and the structured event log both live
// at their own separate paths and are only ever touched when something
// actually happens (an append) or the admin explicitly downloads them —
// never on routine polling, since both keep growing all night and used
// to get re-read from Firebase on every single poll from every device.
const CORE_PATH = "game-core";
const EVENTS_PATH = "game-events";
const LOG_PATH = "game-log";

export class StoreNotConfiguredError extends Error {
  constructor(detail) {
    super(
      detail ||
        "The database isn't connected yet. In your Vercel project's Environment Variables, set FIREBASE_SERVICE_ACCOUNT (the full service account JSON, pasted as one value) and FIREBASE_DATABASE_URL, then redeploy."
    );
    this.name = "StoreNotConfiguredError";
  }
}

// Realtime Database has no native "object" vs "array" distinction — on
// write, a plain object like { 1: {...}, 2: {...} } is stored as nodes
// keyed "1" and "2". On READ, if those keys look like a sequential-ish
// run of integers, the SDK auto-converts the whole thing into a real JS
// array, inserting `null` for any missing index (here: index 0, since
// team/line-index keys start elsewhere). Anything in our schema keyed by
// team id or line index is vulnerable to this — teams, curses,
// linesAwarded, and the per-team maps inside a resolved PD prompt. This
// undoes that conversion so callers always see the plain object shape
// they were written as.
function reobjectify(value) {
  if (!Array.isArray(value)) return value;
  const obj = {};
  value.forEach((v, i) => {
    if (v !== null && v !== undefined) obj[i] = v;
  });
  return obj;
}

function normalizeState(data) {
  if (!data) return data;

  // (1) Fields Firebase may have converted from {1:...,2:...} into a
  // sparse array with null gaps, because the keys look numeric-sequential.
  data.teams = reobjectify(data.teams);
  data.curses = reobjectify(data.curses ?? {});
  data.linesAwarded = reobjectify(data.linesAwarded ?? {});
  if (data.pendingPrompt && data.pendingPrompt.results) {
    const r = data.pendingPrompt.results;
    r.teamChoice = reobjectify(r.teamChoice);
    r.netPoints = reobjectify(r.netPoints);
    r.tally = reobjectify(r.tally);
  }

  // (2) Fields Firebase may have dropped ENTIRELY, because RTDB has no
  // way to represent an empty container ([] / {}) distinctly from "this
  // key doesn't exist" — a state written right after a reset (roster: {},
  // curses: {}) reads back with that key simply missing (undefined)
  // instead of empty. Same for explicit nulls (pendingPrompt: null,
  // timer.startedAt: null) — writing null deletes the key, so it also
  // comes back as undefined, not null.
  data.roster = data.roster && typeof data.roster === "object" ? data.roster : {};
  data.pendingPrompt = data.pendingPrompt ?? null;
  data.speedRound = data.speedRound ?? null;
  if (data.pendingPrompt && !data.pendingPrompt.votes) {
    data.pendingPrompt.votes = data.pendingPrompt.votes ?? {};
  }
  if (data.timer) {
    data.timer.startedAt = data.timer.startedAt ?? null;
  }
  if (Array.isArray(data.board)) {
    data.board.forEach((cell) => {
      if (!cell) return;
      cell.claimedBy = cell.claimedBy ?? null;
      cell.claimedAt = cell.claimedAt ?? null;
      cell.reservedFor = cell.reservedFor ?? null;
    });
  }

  return data;
}

function getDb() {
  const svcJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  const databaseURL = process.env.FIREBASE_DATABASE_URL;
  if (!svcJson || !databaseURL) {
    throw new StoreNotConfiguredError();
  }

  if (!getApps().length) {
    let credentials;
    try {
      credentials = JSON.parse(svcJson);
    } catch {
      throw new StoreNotConfiguredError(
        "FIREBASE_SERVICE_ACCOUNT isn't valid JSON — paste the full contents of the service account key file you downloaded from Firebase, exactly as-is."
      );
    }
    initializeApp({
      credential: cert(credentials),
      databaseURL,
    });
  }

  return getDatabase();
}

// Reads the current CORE state, or null if truly nothing has been saved
// yet (a real, brand-new board). Never touches the events path.
//
// Deliberately does NOT treat "data exists but fails the shape check" the
// same as "nothing exists" anymore. That equivalence was added for the
// one-time 25->36 cell board migration, months ago — everyone's long
// since past that. Keeping it meant ANY future shape mismatch, for
// whatever reason, would silently regenerate a blank game over live data
// instead of surfacing an error — exactly the kind of silent data loss
// that's worse than a loud failure. Only Firebase's own "nothing at this
// path" (!snap.exists()) is treated as safe-to-initialize now.
async function readState() {
  const db = getDb();
  const snap = await db.ref(CORE_PATH).get();
  if (!snap.exists()) return null;
  const data = snap.val();
  if (!data || !Array.isArray(data.board) || data.board.length !== BOARD_CELLS) {
    console.error(
      "[store] CORE data exists but failed shape validation — refusing to silently reset it.",
      JSON.stringify({
        hasData: !!data,
        boardType: data && typeof data.board,
        boardIsArray: !!(data && Array.isArray(data.board)),
        boardLength: data && data.board && data.board.length,
      })
    );
    throw new Error(
      "Saved game data exists but is in an unexpected shape. This needs a look rather than being silently reset — check the server logs for details."
    );
  }
  return normalizeState(data);
}

// Plain overwrite of core — no conflict detection, used by both
// getState()'s one-time initial write and updateState() below.
async function writeState(data) {
  const db = getDb();
  // Realtime Database rejects `undefined` anywhere in the payload (unlike
  // JSON.stringify, which silently drops it) — round-tripping through
  // JSON first guarantees the payload is always RTDB-safe.
  const safe = JSON.parse(JSON.stringify(data));
  await db.ref(CORE_PATH).set(safe);
}

// Appends entries as independent push()-keyed nodes at the given path —
// no read required (push() generates a unique key locally), just one
// batched write covering every entry a single mutation produced. Shared
// by both the structured event log and the narrative log below.
async function appendToLog(path, entries) {
  if (!entries || !entries.length) return;
  const db = getDb();
  const ref = db.ref(path);
  const updates = {};
  entries.forEach((entry) => {
    const key = ref.push().key;
    updates[key] = JSON.parse(JSON.stringify(entry));
  });
  await ref.update(updates);
}

// Reads every entry at the given path, oldest first. Only ever called
// on-demand (the admin "Download game log" button) — never during
// routine polling.
async function readFullLog(path) {
  const db = getDb();
  const snap = await db.ref(path).get();
  if (!snap.exists()) return [];
  const val = snap.val() || {};
  const entries = Object.values(val);
  entries.sort((a, b) => (a && a.ts ? a.ts : 0) - (b && b.ts ? b.ts : 0));
  return entries;
}

async function clearLogPath(path) {
  const db = getDb();
  await db.ref(path).remove();
}

// Public: the full structured event log, for the postgame export.
export async function getEventsLog() {
  return readFullLog(EVENTS_PATH);
}

// Public: the full narrative log ("Snek claimed square 12..."), for the
// postgame export. Never sent to clients during routine play — see
// updateState() below for what DOES go out with an action response.
export async function getFullLog() {
  return readFullLog(LOG_PATH);
}

// Public: read the current state, initializing it if this is the very
// first request the app has ever served.
export async function getState() {
  const existing = await readState();
  if (existing) return existing;
  const fresh = createInitialState();
  await writeState(fresh);
  return fresh;
}

function splitState(next) {
  const events = Array.isArray(next.events) ? next.events : [];
  const log = Array.isArray(next.log) ? next.log : [];
  const core = { ...next };
  delete core.events;
  delete core.log;
  return { core, events, log };
}

// Public: read-modify-write. `mutator` receives a deep-cloned copy of the
// current state, plus two transient scratch arrays — `events` (see
// logEvent()) and `log` (see pushLog()) — and should mutate it in place
// (or return a new object). Both scratch arrays get persisted separately
// afterwards, never as part of the polled core state. The returned
// object carries `log` back to the caller too, but only the handful of
// NEW lines this one mutation produced — e.g. postAdmin() uses
// next.log[0].text for its toast message — not the full history, which
// only ever gets fetched by the postgame export.
//
// This is deliberately a PLAIN read-then-write, not a Firebase
// transaction. An earlier version of this used ref.transaction() to
// close a rare race where two near-simultaneous actions could each read
// a stale pre-completion board and both log the same line bonus. That
// traded a cosmetic, rare issue for a much worse one: firebase-admin's
// transaction() has a documented, unresolved reliability problem, and
// after it shipped here the game started intermittently refusing to
// recognize a clock that had genuinely been started — server-side,
// not just a stale client view. Several rounds of fixes layered on top
// of the transaction mechanism didn't resolve it, which points at the
// mechanism itself rather than any of that surrounding logic. For a
// party game, "last write wins" occasionally duplicating a log line
// under heavy concurrent testing is a far better failure mode than the
// board sometimes not working at all.
//
// `options.clearHistoryFirst` wipes both the event log and the
// narrative log before appending this mutation's own entries — used
// only by "reset entire game".
export async function updateState(mutator, options = {}) {
  const current = (await readState()) || createInitialState();
  const draft = structuredClone(current);
  draft.events = [];
  draft.log = [];
  const next = mutator(draft) || draft;
  const { core, events, log } = splitState(next);
  await writeState(core);
  if (options.clearHistoryFirst) {
    await clearLogPath(EVENTS_PATH);
    await clearLogPath(LOG_PATH);
  }
  await appendToLog(EVENTS_PATH, events);
  await appendToLog(LOG_PATH, log);
  return { ...core, log };
}
