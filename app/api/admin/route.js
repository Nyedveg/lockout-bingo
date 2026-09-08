import { NextResponse } from "next/server";
import { updateState, StoreNotConfiguredError } from "../../../lib/store";
import { ADMIN_PIN, createInitialState, logEvent } from "../../../lib/gameData";
import { startTimer, pauseTimer, resetTimer, computeRemainingSeconds } from "../../../lib/timer";
import {
  adminSetCell,
  swapCells,
  adjustScore,
  renameTeam,
  applyRandomMultiplier,
  bulkSetTasks,
  wheelShuffleBoard,
  wheelUnclaimRandom,
  curseTeam,
  curseAllTeams,
  startGamble,
  clearPrompt,
  startPrisonersDilemma,
  resolvePrisonersDilemma,
  startSpeedRound,
} from "../../../lib/adminActions";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const pin = request.headers.get("x-admin-pin");
  if (pin !== ADMIN_PIN) {
    return NextResponse.json({ error: "unauthorized", message: "Wrong PIN" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid JSON" }, { status: 400 });
  }

  const { type, payload = {} } = body || {};

  if (type === "verifyPin") {
    return NextResponse.json({ ok: true });
  }

  try {
    const next = await updateState((draft) => {
      switch (type) {
        case "timerStart":
          startTimer(draft);
          break;
        case "timerPause":
          pauseTimer(draft);
          break;
        case "timerReset":
          resetTimer(draft);
          break;
        case "setCell":
          adminSetCell(draft, payload.cellId, payload.updates || {});
          break;
        case "swapCells":
          swapCells(draft, payload.cellIdA, payload.cellIdB);
          break;
        case "adjustScore":
          adjustScore(draft, payload.teamId, payload.delta);
          break;
        case "renameTeam":
          renameTeam(draft, payload.teamId, payload.name);
          break;
        case "randomMultiplier":
          applyRandomMultiplier(draft, payload.multiplier);
          break;
        case "bulkSetTasks":
          bulkSetTasks(draft, payload.tasks || {});
          break;
        case "wheelShuffleBoard":
          wheelShuffleBoard(draft);
          break;
        case "wheelUnclaimRandom":
          wheelUnclaimRandom(draft, payload.count || 1);
          break;
        case "curseTeam":
          curseTeam(draft, payload.teamId, payload.kind, payload.durationMs);
          break;
        case "curseAllTeams":
          curseAllTeams(draft, payload.kind, payload.durationMs);
          break;
        case "startGamble":
          startGamble(draft, payload.teamA, payload.teamB, payload.stakes);
          break;
        case "startPrisonersDilemma":
          startPrisonersDilemma(draft);
          break;
        case "resolvePrisonersDilemma":
          resolvePrisonersDilemma(draft);
          break;
        case "clearPrompt":
          clearPrompt(draft);
          break;
        case "startSpeedRound":
          startSpeedRound(draft);
          break;
        case "resetGame": {
          const fresh = createInitialState();
          logEvent(fresh, "game_reset", {});
          return fresh;
        }
        default:
          throw new Error(`Unknown admin action: ${type}`);
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
