"use client";

import { useEffect, useState } from "react";
import { useGameState, postAdmin } from "../hooks/useGameState";
import TimerDisplay from "../components/TimerDisplay";
import Toast from "../components/Toast";
import RosterMenu from "../components/RosterMenu";

const PIN_KEY = "lb_admin_pin";

export default function AdminPage() {
  const [pin, setPin] = useState(null);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");

  useEffect(() => {
    const saved = sessionStorage.getItem(PIN_KEY);
    if (saved) setPin(saved);
  }, []);

  async function trySubmitPin(e) {
    e.preventDefault();
    setPinError("");
    try {
      await postAdmin(pinInput, "verifyPin", {});
      sessionStorage.setItem(PIN_KEY, pinInput);
      setPin(pinInput);
    } catch (err) {
      setPinError("Wrong PIN.");
    }
  }

  if (!pin) {
    return (
      <div className="app-shell">
        <form className="pin-gate" onSubmit={trySubmitPin}>
          <h2 className="stamp-font">Taskmaster Access</h2>
          <p className="status-note">Enter the admin PIN to run the game.</p>
          <input
            type="password"
            inputMode="numeric"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            placeholder="PIN"
            style={{ marginBottom: 10, textAlign: "center" }}
            autoFocus
          />
          {pinError && <p className="status-note error">{pinError}</p>}
          <button className="btn btn-primary btn-block" type="submit">
            Enter
          </button>
        </form>
      </div>
    );
  }

  return <AdminPanel pin={pin} onSignOut={() => { sessionStorage.removeItem(PIN_KEY); setPin(null); }} />;
}

function AdminPanel({ pin, onSignOut }) {
  const { state, error, refresh } = useGameState();
  const [toast, setToast] = useState("");
  const [selectedCell, setSelectedCell] = useState(null);
  const [editTask, setEditTask] = useState("");
  const [editMultiplier, setEditMultiplier] = useState(1);
  const [editReserved, setEditReserved] = useState("");
  const [editClaimed, setEditClaimed] = useState("");
  const [swapA, setSwapA] = useState("");
  const [swapB, setSwapB] = useState("");
  const [scoreDeltas, setScoreDeltas] = useState({});

  useEffect(() => {
    if (!state || selectedCell === null) return;
    const cell = state.board[selectedCell];
    setEditTask(cell.task);
    setEditMultiplier(cell.multiplier);
    setEditReserved(cell.reservedFor || "");
    setEditClaimed(cell.claimedBy || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCell]);

  async function run(type, payload, msg) {
    try {
      await postAdmin(pin, type, payload);
      setToast(msg || "Done");
      refresh();
    } catch (err) {
      if (err.status === 401) {
        sessionStorage.removeItem(PIN_KEY);
        window.location.reload();
        return;
      }
      setToast(err.message || "Action failed");
    }
  }

  async function downloadEvents() {
    try {
      const res = await fetch("/api/events", { headers: { "x-admin-pin": pin } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Export failed");
      const blob = new Blob([JSON.stringify(data.events, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lockout-bingo-events-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setToast(`Exported ${data.events.length} events`);
    } catch (err) {
      setToast(err.message || "Export failed");
    }
  }

  if (error?.error === "blob_not_configured") {
    return (
      <div className="app-shell">
        <div className="center-note">
          <h2 className="stamp-font">Almost there</h2>
          <p>{error.message}</p>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="app-shell">
        <div className="center-note">Loading…</div>
      </div>
    );
  }

  const teamList = Object.values(state.teams);

  return (
    <div className="app-shell">
      <header className="masthead">
        <RosterMenu teams={state.teams} roster={state.roster} />
        <h1>Admin</h1>
        <div className="tagline">Run the game from here</div>
        <div className="team-pill-row">
          <button className="link-btn" onClick={onSignOut}>
            sign out
          </button>
          <a className="link-btn" href="/">
            view player board
          </a>
        </div>
      </header>

      <div className="admin-section">
        <h2>Clock</h2>
        <TimerDisplay timer={state.timer} />
        <div className="admin-row">
          {state.timer.running ? (
            <button className="btn" onClick={() => run("timerPause", {}, "Paused")}>
              Pause
            </button>
          ) : (
            <button className="btn btn-primary" onClick={() => run("timerStart", {}, "Started")}>
              Start
            </button>
          )}
          <button className="btn btn-ghost" onClick={() => run("timerReset", {}, "Reset to 3:00:00")}>
            Reset to 3:00:00
          </button>
        </div>
      </div>

      <div className="admin-section">
        <h2>Board</h2>
        <div className="admin-cell-grid">
          {state.board.map((cell) => (
            <button
              key={cell.id}
              className={`admin-mini-cell${selectedCell === cell.id ? " selected" : ""}`}
              style={{
                background: cell.claimedBy ? state.teams[cell.claimedBy].color : undefined,
                color: cell.claimedBy ? "var(--paper)" : undefined,
              }}
              onClick={() => setSelectedCell(cell.id)}
            >
              {cell.id + 1}
            </button>
          ))}
        </div>

        {selectedCell !== null && (
          <div style={{ marginTop: 14 }}>
            <label className="field-label">Task text — Square {selectedCell + 1}</label>
            <textarea rows={2} value={editTask} onChange={(e) => setEditTask(e.target.value)} />
            <div className="admin-row" style={{ marginTop: 8 }}>
              <div style={{ flex: 1, minWidth: 110 }}>
                <label className="field-label">Multiplier</label>
                <select value={editMultiplier} onChange={(e) => setEditMultiplier(Number(e.target.value))}>
                  <option value={1}>x1</option>
                  <option value={2}>x2</option>
                  <option value={3}>x3</option>
                  <option value={5}>x5</option>
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 110 }}>
                <label className="field-label">Reserved for</label>
                <select value={editReserved} onChange={(e) => setEditReserved(e.target.value)}>
                  <option value="">— none —</option>
                  {teamList.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 110 }}>
                <label className="field-label">Claimed by</label>
                <select value={editClaimed} onChange={(e) => setEditClaimed(e.target.value)}>
                  <option value="">— none / clear —</option>
                  {teamList.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button
              className="btn btn-primary btn-sm"
              style={{ marginTop: 10 }}
              onClick={() =>
                run(
                  "setCell",
                  {
                    cellId: selectedCell,
                    updates: {
                      task: editTask,
                      multiplier: editMultiplier,
                      reservedFor: editReserved ? Number(editReserved) : null,
                      claimedBy: editClaimed ? Number(editClaimed) : null,
                    },
                  },
                  `Square ${selectedCell + 1} updated`
                )
              }
            >
              Apply to square {selectedCell + 1}
            </button>
          </div>
        )}

        <div style={{ marginTop: 18, borderTop: "2px dashed var(--ink-soft)", paddingTop: 12 }}>
          <label className="field-label">Swap two squares (task, multiplier, reserved — not claims)</label>
          <div className="admin-row">
            <input
              type="number"
              min={1}
              max={25}
              placeholder="Square #"
              value={swapA}
              onChange={(e) => setSwapA(e.target.value)}
              style={{ width: 90 }}
            />
            <span>⇄</span>
            <input
              type="number"
              min={1}
              max={25}
              placeholder="Square #"
              value={swapB}
              onChange={(e) => setSwapB(e.target.value)}
              style={{ width: 90 }}
            />
            <button
              className="btn btn-sm"
              onClick={() => {
                const a = Number(swapA) - 1;
                const b = Number(swapB) - 1;
                if (a < 0 || a > 24 || b < 0 || b > 24 || a === b) {
                  setToast("Pick two different squares 1–25");
                  return;
                }
                run("swapCells", { cellIdA: a, cellIdB: b }, `Swapped ${swapA} and ${swapB}`);
                setSwapA("");
                setSwapB("");
              }}
            >
              Swap
            </button>
          </div>
        </div>
      </div>

      <div className="admin-section">
        <h2>Teams &amp; bonus points</h2>
        {teamList.map((team) => (
          <div key={team.id} className="admin-row" style={{ justifyContent: "space-between" }}>
            <span className="team-pill" style={{ "--tc": team.color }}>
              <span className="team-dot" />
              {team.name} · {team.score}
            </span>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="number"
                style={{ width: 70 }}
                placeholder="±pts"
                value={scoreDeltas[team.id] ?? ""}
                onChange={(e) => setScoreDeltas({ ...scoreDeltas, [team.id]: e.target.value })}
              />
              <button
                className="btn btn-sm"
                onClick={() => {
                  const delta = Number(scoreDeltas[team.id] || 0);
                  if (!delta) return;
                  run("adjustScore", { teamId: team.id, delta }, `${team.name} ${delta > 0 ? "+" : ""}${delta}`);
                  setScoreDeltas({ ...scoreDeltas, [team.id]: "" });
                }}
              >
                Apply
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="admin-section">
        <h2>Data &amp; export</h2>
        <p className="status-note">
          Every claim, removal, and admin action is logged with a timestamp and board position — download it
          after the party to build a visualization of how the game unfolded.
        </p>
        <button className="btn btn-block" onClick={downloadEvents}>
          Download event log (JSON)
        </button>
      </div>

      <div className="admin-section">
        <h2>Danger zone</h2>
        <button
          className="btn btn-danger btn-block"
          onClick={() => {
            if (window.confirm("Reset the entire game? Board, scores and timer all go back to zero.")) {
              run("resetGame", {}, "Game reset");
            }
          }}
        >
          Reset entire game
        </button>
      </div>

      <Toast message={toast} onDone={() => setToast("")} />
    </div>
  );
}
