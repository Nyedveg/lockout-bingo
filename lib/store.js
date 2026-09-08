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
  data.teams = reobjectify(data.teams);
  data.curses = reobjectify(data.curses || {});
  data.linesAwarded = reobjectify(data.linesAwarded || {});
  if (data.pendingPrompt && data.pendingPrompt.results) {
    const r = data.pendingPrompt.results;
    r.teamChoice = reobjectify(r.teamChoice);
    r.netPoints = reobjectify(r.netPoints);
    r.tally = reobjectify(r.tally);
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

// Plain overwrite — no transaction/version check. For a party game with a
// handful of players this is simpler and more reliable than optimistic
// concurrency: the rare simultaneous write just has one side win, which
// is a non-issue here (worst case someone re-taps a square).
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

// Public: read-modify-write. `mutator` receives a deep-cloned copy of the
// current state and should mutate it in place (or return a new object).
export async function updateState(mutator) {
  const current = (await readState()) || createInitialState();
  const draft = structuredClone(current);
  const next = (await mutator(draft)) || draft;
  await writeState(next);
  return next;
}
