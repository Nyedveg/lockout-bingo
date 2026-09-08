import { GAMBLE_STAKES, pushLog, logEvent } from "./gameData";

export class PromptError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

export function acceptGamble(state, teamId) {
  const prompt = state.pendingPrompt;
  if (!prompt || prompt.type !== "gamble" || prompt.status !== "awaiting_accept") {
    throw new PromptError("This Gamble isn't waiting on you anymore", "stale_prompt");
  }
  if (prompt.teamB !== teamId) {
    throw new PromptError("This Gamble isn't for your team", "wrong_team");
  }

  const stakes = prompt.stakes || GAMBLE_STAKES;
  const rollA = 1 + Math.floor(Math.random() * 6);
  const rollB = 1 + Math.floor(Math.random() * 6);
  const teamA = state.teams[prompt.teamA];
  const teamB = state.teams[prompt.teamB];

  let winner = null;
  if (rollA > rollB) winner = prompt.teamA;
  else if (rollB > rollA) winner = prompt.teamB;

  if (winner) {
    const loser = winner === prompt.teamA ? prompt.teamB : prompt.teamA;
    state.teams[winner].score += stakes;
    state.teams[loser].score -= stakes;
    pushLog(
      state,
      `Gamble: ${teamA.name} rolled ${rollA}, ${teamB.name} rolled ${rollB} — ${state.teams[winner].name} wins ${stakes} points!`
    );
  } else {
    pushLog(state, `Gamble: ${teamA.name} and ${teamB.name} both rolled ${rollA} — a tie, no points change`);
  }

  prompt.status = "resolved";
  prompt.rollA = rollA;
  prompt.rollB = rollB;
  prompt.winner = winner;
  logEvent(state, "gamble_resolve", { detail: `A:${rollA} B:${rollB} winner:${winner ?? "tie"} stakes:${stakes}` });
  return state;
}

export function castPdVote(state, clientId, teamId, choice) {
  const prompt = state.pendingPrompt;
  if (!prompt || prompt.type !== "prisoners_dilemma" || prompt.status !== "voting") {
    throw new PromptError("Voting isn't open right now", "stale_prompt");
  }
  if (choice !== "silence" && choice !== "snitch") {
    throw new PromptError("Invalid choice", "bad_request");
  }
  if (!prompt.votes) prompt.votes = {};
  prompt.votes[clientId] = { teamId, choice };
  return state;
}
