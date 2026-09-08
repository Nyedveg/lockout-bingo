"use client";

import { useState } from "react";

export default function RosterMenu({ teams, roster }) {
  const [open, setOpen] = useState(false);

  const grouped = {};
  Object.values(teams || {}).forEach((t) => (grouped[t.id] = []));
  Object.values(roster || {}).forEach((p) => {
    if (grouped[p.teamId]) grouped[p.teamId].push(p.name);
  });

  return (
    <div className="roster-wrap">
      <button className="roster-btn" onClick={() => setOpen((o) => !o)} aria-label="Show teams">
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
          </div>
        </>
      )}
    </div>
  );
}
