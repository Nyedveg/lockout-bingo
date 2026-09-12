"use client";

import { useEffect, useState } from "react";
import { postPrompt } from "../hooks/useGameState";
import DiceRoll from "./DiceRoll";

const PD_CARD_URL = "https://gatherer.wizards.com/MKC/en-us/34/prisoners-dilemma";

export default function PromptPopup({ prompt, teams, myTeamId, clientId, applyState, onToast }) {
  const [busy, setBusy] = useState(false);
  const [animDone, setAnimDone] = useState(false);
  const [dismissedId, setDismissedId] = useState(null);

  useEffect(() => {
    setAnimDone(false);
  }, [prompt?.id]);

  if (!prompt || dismissedId === prompt.id) return null;

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
    const stakes = prompt.stakes ?? 3;

    if (prompt.status === "awaiting_accept") {
      const isTarget = myTeamId === prompt.teamB;
      return (
        <div className="blocking-overlay">
          <div className="prompt-card">
            <h3>🎲 Gamble!</h3>
            <p>
              {teamA.name} has challenged {teamB.name}. Winner takes {stakes} points, loser gives up {stakes}.
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
        </div>
      );
    }
    if (prompt.status === "resolved") {
      return (
        <div className="blocking-overlay">
          <div className="prompt-card">
            <h3>🎲 Gamble!</h3>
            {!animDone ? (
              <DiceRoll
                teamA={teamA}
                teamB={teamB}
                rollA={prompt.rollA}
                rollB={prompt.rollB}
                winnerIsA={prompt.winner === prompt.teamA}
                isTie={!prompt.winner}
                onDone={() => setAnimDone(true)}
              />
            ) : (
              <>
                <p>
                  {teamA.name} rolled {prompt.rollA}, {teamB.name} rolled {prompt.rollB}.
                </p>
                <p className="status-note">
                  {prompt.winner ? `${teams[prompt.winner].name} wins ${stakes} points!` : "It's a tie — no points change."}
                </p>
                <button className="btn" onClick={() => setDismissedId(prompt.id)}>
                  Got it
                </button>
              </>
            )}
          </div>
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
              You chose <strong>{myVote.choice === "silence" ? "Silence" : "Snitch"}</strong>. Waiting on the rest of
              the room…
            </p>
          ) : (
            <>
              <p>Vote with your team. Majority within each team decides that team's move.</p>
              <div className="prompt-choices">
                <button className="btn" disabled={busy} onClick={() => respond("pdVote", "silence")}>
                  Silence
                </button>
                <button className="btn btn-danger" disabled={busy} onClick={() => respond("pdVote", "snitch")}>
                  Snitch
                </button>
              </div>
              <p className="status-note" style={{ marginTop: 10, marginBottom: 0 }}>
                <a href={PD_CARD_URL} target="_blank" rel="noreferrer">
                  What's this? (Prisoner's Dilemma, MTG card)
                </a>
              </p>
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
                {t.name} — {teamChoice[t.id] === "silence" ? "Silence" : "Snitch"}
              </span>
              <span>
                {netPoints[t.id] >= 0 ? "+" : ""}
                {netPoints[t.id]}
              </span>
            </div>
          ))}
          <button className="btn" style={{ marginTop: 10 }} onClick={() => setDismissedId(prompt.id)}>
            Got it
          </button>
        </div>
      );
    }
  }

  return null;
}
