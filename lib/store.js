import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { createInitialState, BOARD_CELLS } from "./gameData";

// Everything lives under this one key in the Realtime Database.
const DB_PATH = "game-state";

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
  // key doesn't exist" — a state written right after a reset (log: [],
  // events: [], roster: {}, curses: {}) reads back with that key simply
  // missing (undefined) instead of empty. Same for explicit nulls
  // (pendingPrompt: null, timer.startedAt: null) — writing null deletes
  // the key, so it also comes back as undefined, not null.
  data.log = Array.isArray(data.log) ? data.log : [];
  data.events = Array.isArray(data.events) ? data.events : [];
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

// Reads the current state, or null if nothing valid has been saved yet.
async function readState() {
  const db = getDb();
  const snap = await db.ref(DB_PATH).get();
  if (!snap.exists()) return null;
  const data = snap.val();
  if (!data || !Array.isArray(data.board) || data.board.length !== BOARD_CELLS) {
    // Stale/incompatible schema (e.g. the board size changed since this
    // was last saved) — treat it the same as "nothing saved yet" so a
    // correctly-shaped fresh game state gets created instead of crashing
    // on mismatched cell indices later.
    return null;
  }
  return normalizeState(data);
}

// Plain overwrite — no conflict detection. Used for getState()'s one-time
// initial-write and as updateState()'s fallback if the transaction path
// below fails outright.
async function writeState(data) {
  const db = getDb();
  // Realtime Database rejects `undefined` anywhere in the payload (unlike
  // JSON.stringify, which silently drops it) — round-tripping through
  // JSON first guarantees the payload is always RTDB-safe.
  const safe = JSON.parse(JSON.stringify(data));
  await db.ref(DB_PATH).set(safe);
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

function toValidState(currentData) {
  if (currentData && Array.isArray(currentData.board) && currentData.board.length === BOARD_CELLS) {
    return normalizeState(currentData);
  }
  return createInitialState();
}

// Fallback path if the transaction mechanism itself fails outright (not a
// normal conflict — an actual SDK-level problem). No worse than what this
// app ran on before: a plain read, mutate, overwrite.
async function plainUpdateState(mutator) {
  const current = (await readState()) || createInitialState();
  const draft = structuredClone(current);
  const next = mutator(draft) || draft;
  await writeState(next);
  return next;
}

// Public: read-modify-write, race-safe. `mutator` receives a deep-cloned
// copy of the current state and should mutate it in place (or return a
// new object) — it MUST be synchronous, since Firebase may invoke it
// multiple times internally if another write lands in the meantime, each
// time against the freshest data, until one attempt commits cleanly. That
// retry is exactly what closes the race two near-simultaneous actions
// used to be able to slip through (e.g. two claims each reading a
// pre-completion board and independently — and visibly, if briefly —
// logging the same line bonus).
//
// firebase-admin's transaction() has a known issue where letting the
// update function throw can cause it to hang or misbehave, so the
// callback below never throws: any error from `mutator` (including the
// deliberate ones like "already claimed") is captured and re-thrown
// AFTER the transaction call returns, not from inside it.
export async function updateState(mutator) {
  const db = getDb();
  const ref = db.ref(DB_PATH);

  let mutatorError = null;

  let txResult;
  try {
    txResult = await ref.transaction((currentData) => {
      try {
        const current = toValidState(currentData);
        const draft = structuredClone(current);
        const next = mutator(draft) || draft;
        return JSON.parse(JSON.stringify(next));
      } catch (innerErr) {
        mutatorError = innerErr;
        return undefined; // abort this attempt — nothing gets written
      }
    });
  } catch (outerErr) {
    // The transaction mechanism itself failed (not our mutator) — fall
    // back rather than take the whole game down over one SDK hiccup.
    console.error("Firebase transaction failed, falling back to plain write:", outerErr);
    return plainUpdateState(mutator);
  }

  if (mutatorError) {
    throw mutatorError;
  }
  if (!txResult.committed) {
    throw new Error("Couldn't save that — please try again.");
  }
  return normalizeState(txResult.snapshot.val());
}
