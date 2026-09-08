"use client";

import { useState } from "react";
import { postPrompt } from "../hooks/useGameState";

export default function PromptPopup({ prompt, teams, myTeamId, clientId, applyState, onToast }) {
  const [busy, setBusy] = useState(false);
  if (!prompt) return null;

  async function respond(type, choice) {
    setBusy(true);
    try {
      const next = await postPrompt(type, clientId, myTeamId, choice);
      applyState(next);
    } catch (e) {
      onToast(e.message || "Couldn't send that");
    } finally {
      setBusy(false);
    }
  }

  if (prompt.type === "gamble") {
    const teamA = teams[prompt.teamA];
    const teamB = teams[prompt.teamB];
    if (prompt.status === "awaiting_accept") {
      const isTarget = myTeamId === prompt.teamB;
      return (
        <div className="prompt-card">
          <h3>🎲 Gamble!</h3>
          <p>
            {teamA.name} has challenged {teamB.name}. Winner takes 3 points, loser gives up 3.
          </p>
          {isTarget ? (
            <div className="prompt-choices">
              <button className="btn btn-primary" disabled={busy} onClick={() => respond("acceptGamble")}>
                {busy ? "Rolling…" : "Accept the Gamble"}
              </button>
            </div>
          ) : (
            <p className="status-note">Waiting for {teamB.name} to accept…</p>
          )}
        </div>
      );
    }
    if (prompt.status === "resolved") {
      const winnerName = prompt.winner ? teams[prompt.winner].name : null;
      return (
        <div className="prompt-card">
          <h3>🎲 Gamble result</h3>
          <p>
            {teamA.name} rolled {prompt.rollA}, {teamB.name} rolled {prompt.rollB}.
          </p>
          <p className="status-note">{winnerName ? `${winnerName} wins 3 points!` : "It's a tie — no points change."}</p>
        </div>
      );
    }
  }

  if (prompt.type === "prisoners_dilemma") {
    const myVote = prompt.votes && prompt.votes[clientId];
    if (prompt.status === "voting") {
      return (
        <div className="prompt-card">
          <h3>🤝 Prisoner's Dilemma</h3>
          {myVote ? (
            <p className="status-note">
              You voted <strong>{myVote.choice}</strong>. Waiting on the rest of the room…
            </p>
          ) : (
            <>
              <p>Vote with your team. Majority within each team decides that team's move.</p>
              <div className="prompt-choices">
                <button className="btn" disabled={busy} onClick={() => respond("pdVote", "cooperate")}>
                  Cooperate
                </button>
                <button className="btn btn-danger" disabled={busy} onClick={() => respond("pdVote", "defect")}>
                  Defect
                </button>
              </div>
            </>
          )}
        </div>
      );
    }
    if (prompt.status === "resolved" && prompt.results) {
      const { teamChoice, netPoints } = prompt.results;
      return (
        <div className="prompt-card">
          <h3>🤝 Prisoner's Dilemma result</h3>
          {Object.values(teams).map((t) => (
            <div key={t.id} className="prompt-result-row">
              <span>
                {t.name} — {teamChoice[t.id]}
              </span>
              <span>
                {netPoints[t.id] >= 0 ? "+" : ""}
                {netPoints[t.id]}
              </span>
            </div>
          ))}
        </div>
      );
    }
  }

  return null;
}
