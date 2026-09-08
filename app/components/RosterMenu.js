"use client";

import { useState } from "react";
import { BASE_POINTS, LINE_BONUS, GAMBLE_STAKES } from "../../lib/gameData";

export default function RosterMenu({ teams, roster }) {
  const [open, setOpen] = useState(false);

  const grouped = {};
  Object.values(teams || {}).forEach((t) => (grouped[t.id] = []));
  Object.values(roster || {}).forEach((p) => {
    if (grouped[p.teamId]) grouped[p.teamId].push(p.name);
  });

  return (
    <div className="roster-wrap">
      <button className="roster-btn" onClick={() => setOpen((o) => !o)} aria-label="Show teams and rules">
        ☰
      </button>
      {open && (
        <>
          <div className="roster-backdrop" onClick={() => setOpen(false)} />
          <div className="roster-panel">
            <div className="roster-panel-title">Who's on what team</div>
            {Object.values(teams || {}).map((t) => (
              <div key={t.id} className="roster-team">
                <div className="roster-team-name">
                  <span className="team-dot" style={{ "--tc": t.color }} />
                  {t.name}
                </div>
                <div className="roster-members">
                  {grouped[t.id] && grouped[t.id].length ? grouped[t.id].join(", ") : "— no one yet —"}
                </div>
              </div>
            ))}

            <div className="scoring-rules">
              <div className="roster-panel-title">Scoring rules</div>
              <ul>
                <li>Claiming a square: +{BASE_POINTS} point (×the square's multiplier, if any)</li>
                <li>Undoing your own claim removes those points again</li>
                <li>Completing a full row, column, or diagonal: +{LINE_BONUS} bonus points</li>
                <li>Breaking a completed line (by undoing a claim) removes that bonus again</li>
                <li>A Gamble wheel result is worth {GAMBLE_STAKES} points won or lost</li>
                <li>Highest score when the clock hits zero wins</li>
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
