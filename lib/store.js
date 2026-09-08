import { get, put } from "@vercel/blob";
import { createInitialState, BOARD_CELLS } from "./gameData";

const PATHNAME = "game-state.json";
const ACCESS = "private"; // this project's Blob store is private-only

export class BlobNotConfiguredError extends Error {
  constructor() {
    super(
      "Blob storage isn't connected to this project yet. In the Vercel dashboard, go to Storage -> Create Database -> Blob, connect it to this project, then redeploy."
    );
    this.name = "BlobNotConfiguredError";
  }
}

function assertConfigured() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new BlobNotConfiguredError();
  }
}

function looksLikeMissingBlob(err) {
  const message = String(err && err.message);
  return (err && err.name === "BlobNotFoundError") || /not[-_ ]?found|does not exist/i.test(message);
}

// Reads the current state, or null if nothing has been written yet.
// Private stores must be read through the authenticated SDK (get)
// rather than a plain fetch of a public URL.
async function readState() {
  assertConfigured();
  let result;
  try {
    result = await get(PATHNAME, { access: ACCESS, useCache: false });
  } catch (err) {
    if (looksLikeMissingBlob(err)) return null;
    throw err;
  }
  if (!result || (typeof result.statusCode === "number" && result.statusCode !== 200)) {
    return null;
  }
  const text = await new Response(result.stream).text();
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.board) || data.board.length !== BOARD_CELLS) {
    // Stale/incompatible schema — most likely the board size changed
    // (e.g. 25 -> 36 cells) since this was last saved. Treat it the same
    // as "nothing saved yet" so a correctly-shaped fresh game state gets
    // created instead of crashing on out-of-range cell indices.
    return null;
  }
  return data;
}

// Plain overwrite — no ETag/precondition check. For a party game with a
// handful of players this is simpler and more reliable than optimistic
// concurrency: the rare simultaneous write just has one side win, which
// is a non-issue here (worst case someone re-taps a square).
async function writeState(data) {
  assertConfigured();
  await put(PATHNAME, JSON.stringify(data), {
    access: ACCESS,
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: "application/json",
  });
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
