import { BASE_POINTS, pushLog, logEvent } from "./gameData";
import { applyLineBonuses } from "./scoring";

// Admin can directly set any combination of a cell's fields: reassign
// (or clear) who claimed it, change its multiplier, reserve it for a
// team, or edit its task text. Point totals are kept in sync so the
// scoreboard never drifts from what's shown on the board.
export function adminSetCell(state, cellId, updates) {
  const cell = state.board[cellId];
  if (!cell) throw new Error("Invalid cell");

  if (typeof updates.task === "string") {
    cell.task = updates.task;
    logEvent(state, "edit_task", { cellId, detail: updates.task });
  }

  if (typeof updates.reservedFor !== "undefined") {
    cell.reservedFor = updates.reservedFor;
    if (updates.reservedFor) {
      pushLog(state, `"${cell.task}" reserved for ${state.teams[updates.reservedFor].name}`);
      logEvent(state, "reserve", { cellId, teamId: updates.reservedFor });
    }
  }

  const newMultiplier = typeof updates.multiplier === "number" ? updates.multiplier : cell.multiplier;
  const multiplierChanged = newMultiplier !== cell.multiplier;

  const claimedByChanging = typeof updates.claimedBy !== "undefined" && updates.claimedBy !== cell.claimedBy;

  if (claimedByChanging) {
    const oldOwner = cell.claimedBy ? state.teams[cell.claimedBy] : null;
    if (oldOwner) {
      oldOwner.score -= BASE_POINTS * cell.multiplier;
    }
    cell.multiplier = newMultiplier;
    cell.claimedBy = updates.claimedBy;
    cell.claimedAt = updates.claimedBy ? Date.now() : null;
    if (updates.claimedBy) {
      cell.reservedFor = null;
      const newOwner = state.teams[updates.claimedBy];
      newOwner.score += BASE_POINTS * cell.multiplier;
      pushLog(state, `Admin awarded "${cell.task}" to ${newOwner.name}`);
      logEvent(state, "admin_claim", { cellId, teamId: updates.claimedBy, points: BASE_POINTS * cell.multiplier });
    } else {
      pushLog(state, `Admin cleared the claim on "${cell.task}"`);
      logEvent(state, "admin_unclaim", { cellId, teamId: oldOwner ? oldOwner.id : null });
    }
  } else if (multiplierChanged) {
    if (cell.claimedBy) {
      const owner = state.teams[cell.claimedBy];
      owner.score += BASE_POINTS * (newMultiplier - cell.multiplier);
    }
    cell.multiplier = newMultiplier;
    pushLog(state, `"${cell.task}" multiplier set to x${newMultiplier}`);
    logEvent(state, "multiplier_change", { cellId, detail: `x${newMultiplier}` });
  }

  applyLineBonuses(state);
  return state;
}

export function swapCells(state, cellIdA, cellIdB) {
  const a = state.board[cellIdA];
  const b = state.board[cellIdB];
  if (!a || !b) throw new Error("Invalid cells");
  const fields = ["task", "prize", "multiplier", "reservedFor"];
  for (const f of fields) {
    const tmp = a[f];
    a[f] = b[f];
    b[f] = tmp;
  }
  pushLog(state, `Admin swapped squares ${cellIdA + 1} and ${cellIdB + 1}`);
  logEvent(state, "swap", { cellId: cellIdA, detail: `swapped with ${cellIdB}` });
  return state;
}

export function adjustScore(state, teamId, delta) {
  const team = state.teams[teamId];
  if (!team) throw new Error("Invalid team");
  team.score += delta;
  pushLog(state, `Admin gave ${team.name} ${delta >= 0 ? "+" : ""}${delta} points`);
  logEvent(state, "score_adjust", { teamId, points: delta });
  return state;
}

export function renameTeam(state, teamId, name) {
  const team = state.teams[teamId];
  if (!team) throw new Error("Invalid team");
  team.name = name;
  return state;
}
