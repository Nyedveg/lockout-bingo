import { LINES, BASE_POINTS, LINE_BONUS, pushLog, logEvent } from "./gameData";
import { computeRemainingSeconds } from "./timer";

// Checks all 14 lines; for any line that's now fully owned by one team
// and hasn't been awarded yet, credits that team once. lineIndex keys are
// coerced to strings explicitly (rather than relying on JS's implicit
// numeric-key coercion) so this stays airtight regardless of what shape
// linesAwarded arrives in after a round trip through the database.
export function applyLineBonuses(state) {
  LINES.forEach((line, idx) => {
    const key = String(idx);
    if (Object.prototype.hasOwnProperty.call(state.linesAwarded, key)) return;
    const owners = line.map((cellId) => state.board[cellId].claimedBy);
    if (owners.every((o) => o !== null && o === owners[0])) {
      const teamId = owners[0];
      state.linesAwarded[key] = teamId;
      const team = state.teams[teamId];
      team.linesCompleted += 1;
      team.score += LINE_BONUS;
      pushLog(state, `${team.name} completed a full line! +${LINE_BONUS} bonus points`);
      logEvent(state, "line_bonus", { teamId, lineIndex: idx, points: LINE_BONUS });
    }
  });
}

// Call this whenever a cell's claimedBy is about to change (unclaimed,
// stolen, or admin-cleared). If that cell was part of a line that had
// already been awarded, and the line is no longer intact, the bonus is
// revoked so a broken line never leaves free points behind.
export function revokeBrokenLineBonuses(state, cellId) {
  LINES.forEach((line, idx) => {
    if (!line.includes(cellId)) return;
    const key = String(idx);
    if (!Object.prototype.hasOwnProperty.call(state.linesAwarded, key)) return;
    const awardedTo = state.linesAwarded[key];
    const owners = line.map((id) => state.board[id].claimedBy);
    const stillIntact = owners.every((o) => o !== null && o === owners[0]);
    if (!stillIntact) {
      delete state.linesAwarded[key];
      const team = state.teams[awardedTo];
      if (team) {
        team.score -= LINE_BONUS;
        team.linesCompleted = Math.max(0, team.linesCompleted - 1);
        pushLog(state, `${team.name} lost their line bonus — that line was broken`);
        logEvent(state, "line_broken", { teamId: awardedTo, lineIndex: idx, points: -LINE_BONUS });
      }
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
    revokeBrokenLineBonuses(state, cellId);
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
  let points = BASE_POINTS * (cell.multiplier || 1);

  let speedRoundHit = false;
  if (state.speedRound && !state.speedRound.consumed && state.speedRound.expiresAt > Date.now()) {
    points *= 2;
    state.speedRound.consumed = true;
    speedRoundHit = true;
  }

  team.score += points;
  pushLog(
    state,
    speedRoundHit
      ? `⚡ ${team.name} claimed "${cell.task}" during the Speed Round for double! (+${points})`
      : `${team.name} claimed "${cell.task}" (+${points})`
  );
  logEvent(state, "claim", { teamId, cellId, points, speedRound: speedRoundHit });
  applyLineBonuses(state);
  return state;
}
