import { NextResponse } from "next/server";
import { updateState, BlobNotConfiguredError } from "../../../lib/store";
import { acceptGamble, castPdVote, PromptError } from "../../../lib/prompts";
import { computeRemainingSeconds } from "../../../lib/timer";

export const dynamic = "force-dynamic";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid JSON" }, { status: 400 });
  }

  const { type, clientId, teamId, choice } = body || {};
  if (!clientId || ![1, 2, 3].includes(teamId)) {
    return NextResponse.json({ error: "bad_request", message: "Missing clientId/teamId" }, { status: 400 });
  }

  try {
    const next = await updateState((draft) => {
      if (type === "acceptGamble") {
        acceptGamble(draft, teamId);
      } else if (type === "pdVote") {
        castPdVote(draft, clientId, teamId, choice);
      } else {
        throw new PromptError("Unknown prompt action", "bad_request");
      }
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
    if (err instanceof PromptError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: "server_error", message: String(err.message || err) }, { status: 500 });
  }
}
