import { BASE_POINTS, pushLog, logEvent, BLINDNESS_MS, TIME_DILATION_MS, SPEED_ROUND_MS, PD_PAYOFF } from "./gameData";
import { applyLineBonuses, revokeBrokenLineBonuses } from "./scoring";

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
    revokeBrokenLineBonuses(state, cellId);
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
  const fields = ["task", "multiplier", "reservedFor"];
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

// Sets a specific cell's multiplier on a RANDOM open (unclaimed) square —
// the "Apply randomly" button, and the engine behind the C-c-c-combo and
// Double Trouble wheel results.
export function applyRandomMultiplier(state, multiplier) {
  const eligible = state.board.filter((c) => !c.claimedBy);
  if (!eligible.length) {
    pushLog(state, "No open squares available for a random multiplier");
    return state;
  }
  const cell = eligible[Math.floor(Math.random() * eligible.length)];
  cell.multiplier = multiplier;
  pushLog(state, `Square ${cell.id + 1} ("${cell.task}") set to x${multiplier} (random)`);
  logEvent(state, "multiplier_change", { cellId: cell.id, detail: `x${multiplier} (random)` });
  return state;
}

// ---------- Wheel effects ----------

export function wheelShuffleBoard(state) {
  const openCells = state.board.filter((c) => !c.claimedBy);
  if (openCells.length < 2) {
    pushLog(state, "Not enough open squares to shuffle");
    return state;
  }
  const fields = openCells.map((c) => ({
    task: c.task,
    multiplier: c.multiplier,
    reservedFor: c.reservedFor,
  }));
  for (let i = fields.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [fields[i], fields[j]] = [fields[j], fields[i]];
  }
  openCells.forEach((cell, i) => {
    Object.assign(cell, fields[i]);
  });
  pushLog(state, `The Taskmaster shuffled ${openCells.length} open squares!`);
  logEvent(state, "wheel_shuffle_board", { detail: `${openCells.length} squares` });
  return state;
}

export function wheelUnclaimRandom(state) {
  const claimed = state.board.filter((c) => c.claimedBy);
  if (!claimed.length) {
    pushLog(state, "No claimed squares to undo — nothing happened");
    return state;
  }
  const cell = claimed[Math.floor(Math.random() * claimed.length)];
  const team = state.teams[cell.claimedBy];
  const points = BASE_POINTS * (cell.multiplier || 1);
  team.score -= points;
  cell.claimedBy = null;
  cell.claimedAt = null;
  revokeBrokenLineBonuses(state, cell.id);
  pushLog(state, `Oops! ${team.name} lost their claim on square ${cell.id + 1}`);
  logEvent(state, "wheel_oops", { cellId: cell.id, teamId: team.id, points: -points });
  return state;
}

export function curseTeam(state, teamId, kind) {
  const team = state.teams[teamId];
  if (!team) throw new Error("Invalid team");
  if (!state.curses) state.curses = {};
  if (!state.curses[teamId]) state.curses[teamId] = {};
  if (kind === "blindness") {
    state.curses[teamId].blindUntil = Date.now() + BLINDNESS_MS;
    pushLog(state, `${team.name} has been cursed with Blindness for 15 minutes!`);
    logEvent(state, "curse_blindness", { teamId });
  } else if (kind === "timeDilation") {
    state.curses[teamId].timeDilationUntil = Date.now() + TIME_DILATION_MS;
    pushLog(state, `${team.name} has been cursed with Time Dilation for 30 minutes!`);
    logEvent(state, "curse_time_dilation", { teamId });
  } else {
    throw new Error("Invalid curse kind");
  }
  return state;
}

export function startSpeedRound(state) {
  state.speedRound = { expiresAt: Date.now() + SPEED_ROUND_MS, consumed: false };
  pushLog(state, "⚡ Speed Round! The next square claimed in the next 5 minutes scores double!");
  logEvent(state, "speed_round_start", {});
  return state;
}

// ---------- Gamble ----------

export function startGamble(state, teamA, teamB) {
  if (teamA === teamB) throw new Error("Pick two different teams");
  if (!state.teams[teamA] || !state.teams[teamB]) throw new Error("Invalid team");
  state.pendingPrompt = {
    type: "gamble",
    id: `g_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
    teamA,
    teamB,
    status: "awaiting_accept",
    createdAt: Date.now(),
  };
  pushLog(state, `${state.teams[teamA].name} challenges ${state.teams[teamB].name} to a Gamble!`);
  logEvent(state, "gamble_start", { teamId: teamB, detail: `challenged by team ${teamA}` });
  return state;
}

export function clearPrompt(state) {
  state.pendingPrompt = null;
  return state;
}

// ---------- Prisoner's Dilemma ----------

export function startPrisonersDilemma(state) {
  state.pendingPrompt = {
    type: "prisoners_dilemma",
    id: `pd_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
    status: "voting",
    votes: {}, // { [clientId]: { teamId, choice } }
    createdAt: Date.now(),
  };
  pushLog(state, "The Taskmaster calls for a round of Prisoner's Dilemma — everyone vote!");
  logEvent(state, "pd_start", {});
  return state;
}

export function resolvePrisonersDilemma(state) {
  const prompt = state.pendingPrompt;
  if (!prompt || prompt.type !== "prisoners_dilemma") throw new Error("No Prisoner's Dilemma in progress");

  const teamIds = Object.keys(state.teams).map(Number);
  const tally = {};
  teamIds.forEach((id) => (tally[id] = { cooperate: 0, defect: 0 }));
  Object.values(prompt.votes || {}).forEach((v) => {
    if (tally[v.teamId]) tally[v.teamId][v.choice] += 1;
  });
  // Majority per team; ties default to "defect" (the risk-averse read).
  const teamChoice = {};
  teamIds.forEach((id) => {
    const t = tally[id];
    teamChoice[id] = t.cooperate > t.defect ? "cooperate" : "defect";
  });

  const netPoints = {};
  teamIds.forEach((id) => (netPoints[id] = 0));

  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      const a = teamIds[i];
      const b = teamIds[j];
      const ca = teamChoice[a];
      const cb = teamChoice[b];
      if (ca === "cooperate" && cb === "cooperate") {
        netPoints[a] += PD_PAYOFF.bothCooperate;
        netPoints[b] += PD_PAYOFF.bothCooperate;
      } else if (ca === "defect" && cb === "defect") {
        netPoints[a] += PD_PAYOFF.bothDefect;
        netPoints[b] += PD_PAYOFF.bothDefect;
      } else if (ca === "defect" && cb === "cooperate") {
        netPoints[a] += PD_PAYOFF.defectorBonus;
        netPoints[b] += PD_PAYOFF.betrayedPenalty;
      } else {
        netPoints[b] += PD_PAYOFF.defectorBonus;
        netPoints[a] += PD_PAYOFF.betrayedPenalty;
      }
    }
  }

  teamIds.forEach((id) => {
    state.teams[id].score += netPoints[id];
  });

  prompt.status = "resolved";
  prompt.results = { teamChoice, netPoints, tally };
  teamIds.forEach((id) => {
    pushLog(
      state,
      `${state.teams[id].name} chose to ${teamChoice[id]} (${netPoints[id] >= 0 ? "+" : ""}${netPoints[id]} pts)`
    );
  });
  logEvent(state, "pd_resolve", { detail: JSON.stringify({ teamChoice, netPoints }) });
  return state;
}
