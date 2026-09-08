"use client";

import { useMemo, useState } from "react";
import { TALENT_SHOW_BONUS } from "../../lib/gameData";

const SEGMENTS = [
  { key: "shuffle", label: "Shuffle Board", color: "#7a1f2b" },
  { key: "reroll", label: "Reroll Tile", color: "#2b3a55" },
  { key: "blindness", label: "Blindness", color: "#123f2e" },
  { key: "pd", label: "P. Dilemma", color: "#c68a2e" },
  { key: "bonus", label: "Bonus +1", color: "#7a1f2b" },
  { key: "yikes", label: "Yikes -1", color: "#2b3a55" },
  { key: "timeDilation", label: "Time Dilation", color: "#123f2e" },
  { key: "combo", label: "C-c-c-combo x5", color: "#c68a2e" },
  { key: "bookAppt", label: "Book Appt.", color: "#7a1f2b" },
  { key: "switcheroo", label: "Switcheroo", color: "#2b3a55" },
  { key: "gamble", label: "Gamble", color: "#123f2e" },
  { key: "doubleTrouble", label: "Double Trouble x2", color: "#c68a2e" },
  { key: "oops", label: "Oops", color: "#7a1f2b" },
  { key: "speedRound", label: "Speed Round", color: "#2b3a55" },
  { key: "talentShow", label: "Talent Show", color: "#123f2e" },
];

const SEG_ANGLE = 360 / SEGMENTS.length;
const SPIN_MS = 4600;

export default function WheelModal({ state, run, onClose }) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [landedIndex, setLandedIndex] = useState(null);
  const [rerollCell, setRerollCell] = useState(null);
  const [rerollText, setRerollText] = useState("");
  const [teamA, setTeamA] = useState(null);
  const [teamB, setTeamB] = useState(null);
  const [cellA, setCellA] = useState("");
  const [cellB, setCellB] = useState("");

  const teams = Object.values(state.teams);

  const gradient = useMemo(
    () => SEGMENTS.map((s, i) => `${s.color} ${i * SEG_ANGLE}deg ${(i + 1) * SEG_ANGLE}deg`).join(", "),
    []
  );

  function resetPickers() {
    setTeamA(null);
    setTeamB(null);
    setCellA("");
    setCellB("");
    setRerollText("");
    setRerollCell(null);
  }

  function spin() {
    if (spinning) return;
    resetPickers();
    const idx = Math.floor(Math.random() * SEGMENTS.length);
    const mid = idx * SEG_ANGLE + SEG_ANGLE / 2;
    const baseR = (360 - mid + 360) % 360;
    const spins = 5;
    setRotation((prev) => {
      const prevMod = ((prev % 360) + 360) % 360;
      return prev + (spins * 360 + baseR - prevMod);
    });
    setSpinning(true);
    setLandedIndex(null);
    setTimeout(() => {
      setSpinning(false);
      setLandedIndex(idx);
      if (SEGMENTS[idx].key === "reroll") {
        const open = state.board.filter((c) => !c.claimedBy);
        if (open.length) {
          const cell = open[Math.floor(Math.random() * open.length)];
          setRerollCell(cell.id);
          setRerollText(cell.task);
        }
      }
    }, SPIN_MS);
  }

  const landed = landedIndex !== null ? SEGMENTS[landedIndex] : null;

  return (
    <div className="wheel-overlay" onClick={onClose}>
      <div className="wheel-card" onClick={(e) => e.stopPropagation()}>
        <button className="wheel-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <h2 className="stamp-font">Spin the Wheel</h2>

        <div className="wheel-spinner-wrap">
          <div className="wheel-pointer" />
          <div className="wheel-hub" />
          <div
            className="wheel-face"
            style={{ background: `conic-gradient(${gradient})`, transform: `rotate(${rotation}deg)` }}
          >
            {SEGMENTS.map((s, i) => {
              const mid = i * SEG_ANGLE + SEG_ANGLE / 2;
              return (
                <div key={s.key} className="wheel-label" style={{ transform: `rotate(${mid}deg) translateX(6px)` }}>
                  {s.label}
                </div>
              );
            })}
          </div>
        </div>

        <button className="btn btn-primary btn-block" disabled={spinning} onClick={spin}>
          {spinning ? "Spinning…" : "Spin"}
        </button>

        {landed && (
          <div className="wheel-result-card">
            <h4>{landed.label}</h4>

            {landed.key === "shuffle" && (
              <>
                <p>Randomly shuffles the tasks on all uncompleted tiles.</p>
                <button className="btn btn-block" onClick={() => run("wheelShuffleBoard", {}, null)}>
                  Shuffle now
                </button>
              </>
            )}

            {landed.key === "reroll" && rerollCell !== null && (
              <>
                <p>Square {rerollCell + 1} was picked. Type its new task, then save.</p>
                <textarea rows={2} value={rerollText} onChange={(e) => setRerollText(e.target.value)} />
                <button
                  className="btn btn-block"
                  style={{ marginTop: 8 }}
                  onClick={() =>
                    run(
                      "setCell",
                      { cellId: rerollCell, updates: { task: rerollText } },
                      `Square ${rerollCell + 1} rerolled`
                    )
                  }
                >
                  Save new task
                </button>
              </>
            )}

            {(landed.key === "blindness" ||
              landed.key === "timeDilation" ||
              landed.key === "bonus" ||
              landed.key === "yikes" ||
              landed.key === "bookAppt") && (
              <>
                <p>
                  {landed.key === "blindness" && "Curse a team — they can't see their tasks for 15 minutes."}
                  {landed.key === "timeDilation" && "Curse a team — they can't see the clock for 30 minutes."}
                  {landed.key === "bonus" && "Give a team 1 free point."}
                  {landed.key === "yikes" && "A team loses 1 point."}
                  {landed.key === "bookAppt" && "Reserve a random open square for a team."}
                </p>
                <div className="wheel-team-picker">
                  {teams.map((t) => (
                    <button
                      key={t.id}
                      className={`wheel-team-btn${teamA === t.id ? " selected" : ""}`}
                      style={{ "--tc": t.color }}
                      onClick={() => setTeamA(t.id)}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
                <button
                  className="btn btn-block"
                  disabled={!teamA}
                  onClick={() => {
                    if (landed.key === "blindness") run("curseTeam", { teamId: teamA, kind: "blindness" }, null);
                    else if (landed.key === "timeDilation")
                      run("curseTeam", { teamId: teamA, kind: "timeDilation" }, null);
                    else if (landed.key === "bonus") run("adjustScore", { teamId: teamA, delta: 1 }, null);
                    else if (landed.key === "yikes") run("adjustScore", { teamId: teamA, delta: -1 }, null);
                    else if (landed.key === "bookAppt") {
                      const open = state.board.filter((c) => !c.claimedBy);
                      if (!open.length) return;
                      const cell = open[Math.floor(Math.random() * open.length)];
                      run("setCell", { cellId: cell.id, updates: { reservedFor: teamA } }, null);
                    }
                  }}
                >
                  Apply to {teamA ? teams.find((t) => t.id === teamA)?.name : "…"}
                </button>
              </>
            )}

            {landed.key === "pd" && (
              <>
                <p>
                  Opens voting for every player. Resolve it from the "Live prompt" section below once enough votes
                  are in.
                </p>
                <button className="btn btn-block" onClick={() => run("startPrisonersDilemma", {}, null)}>
                  Start voting
                </button>
              </>
            )}

            {landed.key === "combo" && (
              <>
                <p>Adds a x5 multiplier to a random open square.</p>
                <button className="btn btn-block" onClick={() => run("randomMultiplier", { multiplier: 5 }, null)}>
                  Do it
                </button>
              </>
            )}

            {landed.key === "doubleTrouble" && (
              <>
                <p>Pick a square to give it a x2 multiplier.</p>
                <input
                  type="number"
                  min={1}
                  max={25}
                  placeholder="Square #"
                  value={cellA}
                  onChange={(e) => setCellA(e.target.value)}
                  style={{ marginBottom: 8 }}
                />
                <button
                  className="btn btn-block"
                  disabled={!cellA}
                  onClick={() => {
                    const id = Number(cellA) - 1;
                    if (id < 0 || id > 24) return;
                    run("setCell", { cellId: id, updates: { multiplier: 2 } }, null);
                  }}
                >
                  Apply x2
                </button>
              </>
            )}

            {landed.key === "switcheroo" && (
              <>
                <p>Pick two squares to swap.</p>
                <div className="admin-row">
                  <input
                    type="number"
                    min={1}
                    max={25}
                    placeholder="Square #"
                    value={cellA}
                    onChange={(e) => setCellA(e.target.value)}
                    style={{ width: 90 }}
                  />
                  <span>⇄</span>
                  <input
                    type="number"
                    min={1}
                    max={25}
                    placeholder="Square #"
                    value={cellB}
                    onChange={(e) => setCellB(e.target.value)}
                    style={{ width: 90 }}
                  />
                </div>
                <button
                  className="btn btn-block"
                  style={{ marginTop: 8 }}
                  disabled={!cellA || !cellB}
                  onClick={() => {
                    const a = Number(cellA) - 1;
                    const b = Number(cellB) - 1;
                    if (a < 0 || a > 24 || b < 0 || b > 24 || a === b) return;
                    run("swapCells", { cellIdA: a, cellIdB: b }, null);
                  }}
                >
                  Swap
                </button>
              </>
            )}

            {landed.key === "gamble" && (
              <>
                <p>Pick the challenger and the target team. The target gets an Accept prompt on their phones.</p>
                <div className="field-label">Challenger</div>
                <div className="wheel-team-picker">
                  {teams.map((t) => (
                    <button
                      key={t.id}
                      className={`wheel-team-btn${teamA === t.id ? " selected" : ""}`}
                      style={{ "--tc": t.color }}
                      onClick={() => setTeamA(t.id)}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
                <div className="field-label">Target</div>
                <div className="wheel-team-picker">
                  {teams.map((t) => (
                    <button
                      key={t.id}
                      className={`wheel-team-btn${teamB === t.id ? " selected" : ""}`}
                      style={{ "--tc": t.color }}
                      onClick={() => setTeamB(t.id)}
                      disabled={teamA === t.id}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
                <button
                  className="btn btn-block"
                  disabled={!teamA || !teamB || teamA === teamB}
                  onClick={() => run("startGamble", { teamA, teamB }, null)}
                >
                  Send challenge
                </button>
              </>
            )}

            {landed.key === "oops" && (
              <>
                <p>Unclaims one random claimed square on the board.</p>
                <button className="btn btn-block" onClick={() => run("wheelUnclaimRandom", {}, null)}>
                  Do it
                </button>
              </>
            )}

            {landed.key === "speedRound" && (
              <>
                <p>Starts a 5-minute window — whichever team claims a square first scores double for it.</p>
                <button className="btn btn-block" onClick={() => run("startSpeedRound", {}, null)}>
                  Start Speed Round
                </button>
              </>
            )}

            {landed.key === "talentShow" && (
              <>
                <p>All teams perform something silly — you judge the winner for +{TALENT_SHOW_BONUS} points.</p>
                <div className="wheel-team-picker">
                  {teams.map((t) => (
                    <button
                      key={t.id}
                      className={`wheel-team-btn${teamA === t.id ? " selected" : ""}`}
                      style={{ "--tc": t.color }}
                      onClick={() => setTeamA(t.id)}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
                <button
                  className="btn btn-block"
                  disabled={!teamA}
                  onClick={() => run("adjustScore", { teamId: teamA, delta: TALENT_SHOW_BONUS }, null)}
                >
                  Award winner +{TALENT_SHOW_BONUS}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
