import { get, put } from "@vercel/blob";
import { createInitialState } from "./gameData";

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

// Reads the current state + its etag. Returns { data, etag } or null if
// nothing has been written yet. Private stores must be read through the
// authenticated SDK (get) rather than a plain fetch of a public URL.
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
  const etag = result.blob ? result.blob.etag : result.etag;
  return { data, etag };
}

async function writeState(data, etag) {
  assertConfigured();
  const options = {
    access: ACCESS,
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: "application/json",
  };
  if (etag) options.ifMatch = etag;
  return put(PATHNAME, JSON.stringify(data), options);
}

// Public: read the current state, initializing it if this is the very
// first request the app has ever served.
export async function getState() {
  const existing = await readState();
  if (existing) return existing.data;
  const fresh = createInitialState();
  await writeState(fresh, null);
  return fresh;
}

// Public: read-modify-write with a few retries to absorb the rare case
// where two people tap different squares at almost the same instant.
// `mutator` receives a deep-cloned copy of the current state and should
// mutate it in place (or return a new object).
export async function updateState(mutator, attempts = 4) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    const existing = await readState();
    const current = existing ? existing.data : createInitialState();
    const etag = existing ? existing.etag : null;
    const draft = structuredClone(current);
    const next = (await mutator(draft)) || draft;
    try {
      await writeState(next, etag);
      return next;
    } catch (err) {
      lastErr = err;
      const isConflict =
        err &&
        (err.name === "BlobPreconditionFailedError" ||
          /precondition/i.test(String(err.message)) ||
          (err.status && err.status === 412));
      if (!isConflict) throw err;
      // else loop and retry against fresh state
    }
  }
  throw lastErr || new Error("Failed to update game state after several attempts");
}
