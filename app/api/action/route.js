import { NextResponse } from "next/server";
import { updateState, BlobNotConfiguredError } from "../../../lib/store";
import { toggleCell, ClaimError } from "../../../lib/scoring";
import { computeRemainingSeconds } from "../../../lib/timer";

export const dynamic = "force-dynamic";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid JSON" }, { status: 400 });
  }

  const { teamId, cellId } = body || {};
  if (![1, 2, 3].includes(teamId) || typeof cellId !== "number" || cellId < 0 || cellId > 24) {
    return NextResponse.json({ error: "bad_request", message: "Missing or invalid teamId/cellId" }, { status: 400 });
  }

  try {
    const next = await updateState((draft) => {
      toggleCell(draft, teamId, cellId);
      return draft;
    });
    return NextResponse.json({
      ...next,
      timer: { ...next.timer, remainingSeconds: computeRemainingSeconds(next.timer) },
    });
  } catch (err) {
    if (err instanceof BlobNotConfiguredError) {
      return NextResponse.json({ error: "blob_not_configured", message: err.message }, { status: 503 });
    }
    if (err instanceof ClaimError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: "server_error", message: String(err.message || err) }, { status: 500 });
  }
}
