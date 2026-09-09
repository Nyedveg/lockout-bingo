import { NextResponse } from "next/server";
import { updateState, StoreNotConfiguredError } from "../../../lib/store";
import { pushLog, logEvent } from "../../../lib/gameData";
import { computeRemainingSeconds } from "../../../lib/timer";

export const dynamic = "force-dynamic";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid JSON" }, { status: 400 });
  }

  const { clientId, teamId, name } = body || {};
  if (
    typeof clientId !== "string" ||
    !clientId ||
    ![1, 2, 3].includes(teamId) ||
    typeof name !== "string" ||
    !name.trim()
  ) {
    return NextResponse.json(
      { error: "bad_request", message: "Missing or invalid clientId/teamId/name" },
      { status: 400 }
    );
  }
  const cleanName = name.trim().slice(0, 30);

  try {
    const next = await updateState((draft) => {
      if (!draft.roster) draft.roster = {};
      const prev = draft.roster[clientId];
      draft.roster[clientId] = {
        name: cleanName,
        teamId,
        joinedAt: prev?.joinedAt || Date.now(),
      };
      if (!prev || prev.teamId !== teamId || prev.name !== cleanName) {
        pushLog(draft, `${cleanName} joined ${draft.teams[teamId].name}`);
        logEvent(draft, "join", { teamId, detail: cleanName });
      }
      return draft;
    });
    return NextResponse.json({
      ...next,
      timer: { ...next.timer, remainingSeconds: computeRemainingSeconds(next.timer) },
    });
  } catch (err) {
    if (err instanceof StoreNotConfiguredError) {
      return NextResponse.json({ error: "store_not_configured", message: err.message }, { status: 503 });
    }
    console.error(err);
    return NextResponse.json({ error: "server_error", message: String(err.message || err) }, { status: 500 });
  }
}
