import { LINES, BASE_POINTS, LINE_BONUS, pushLog, logEvent } from "./gameData";
import { computeRemainingSeconds } from "./timer";

// Checks all 12 lines; for any line that's now fully owned by one team
// and hasn't been awarded yet, credits that team once.
export function applyLineBonuses(state) {
  LINES.forEach((line, idx) => {
    if (state.linesAwarded[idx]) return;
    const owners = line.map((cellId) => state.board[cellId].claimedBy);
    if (owners.every((o) => o !== null && o === owners[0])) {
      const teamId = owners[0];
      state.linesAwarded[idx] = teamId;
      const team = state.teams[teamId];
      team.linesCompleted += 1;
      team.score += LINE_BONUS;
      pushLog(state, `${team.name} completed a full line! +${LINE_BONUS} bonus points`);
      logEvent(state, "line_bonus", { teamId, lineIndex: idx, points: LINE_BONUS });
    }
  });
}

export class ClaimError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

// Tapping a square toggles it: unclaimed (and eligible) -> claimed by
// your team; already claimed by your team -> removed again. Claimed by
// someone else, or reserved for someone else, is rejected.
export function toggleCell(state, teamId, cellId) {
  const cell = state.board[cellId];
  const team = state.teams[teamId];
  if (!cell || !team) throw new ClaimError("Invalid cell or team", "invalid");

  const gameStarted = state.timer.running || state.timer.remainingSeconds < state.timer.durationSeconds;
  if (!gameStarted) {
    throw new ClaimError("The game hasn't started yet", "not_started");
  }
  if (computeRemainingSeconds(state.timer) <= 0) {
    throw new ClaimError("Time's up! No more changes.", "time_up");
  }

  if (cell.claimedBy === teamId) {
    // Remove our own claim.
    const points = BASE_POINTS * (cell.multiplier || 1);
    team.score -= points;
    cell.claimedBy = null;
    cell.claimedAt = null;
    pushLog(state, `${team.name} removed their claim on "${cell.task}"`);
    logEvent(state, "unclaim", { teamId, cellId, points: -points });
    return state;
  }

  if (cell.claimedBy) {
    throw new ClaimError("That square is already claimed", "already_claimed");
  }
  if (cell.reservedFor && cell.reservedFor !== teamId) {
    throw new ClaimError("That square is reserved for another team", "reserved");
  }

  cell.claimedBy = teamId;
  cell.claimedAt = Date.now();
  cell.reservedFor = null;
  const points = BASE_POINTS * (cell.multiplier || 1);
  team.score += points;
  pushLog(state, `${team.name} claimed "${cell.task}" (+${points})`);
  logEvent(state, "claim", { teamId, cellId, points });
  applyLineBonuses(state);
  return state;
}
