"use client";

import { useEffect, useState } from "react";
import { useGameState, postAdmin } from "../hooks/useGameState";
import TimerDisplay from "../components/TimerDisplay";
import Toast from "../components/Toast";
import RosterMenu from "../components/RosterMenu";
import WheelModal from "../components/WheelModal";
import { BOARD_CELLS } from "../../lib/gameData";

const PIN_KEY = "lb_admin_pin";

function parseBulkTasks(raw) {
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const tasks = {};
  const errors = [];
  for (const line of lines) {
    const idx = line.indexOf(";");
    if (idx === -1) {
      errors.push(`No ";" found: "${line}"`);
      continue;
    }
    const numStr = line.slice(0, idx).trim();
    const text = line.slice(idx + 1).trim();
    const num = Number(numStr);
    if (!Number.isInteger(num) || num < 1 || num > BOARD_CELLS) {
      errors.push(`Invalid square number "${numStr}" in: "${line}"`);
      continue;
    }
    if (!text) {
      errors.push(`Empty task text for square ${num}`);
      continue;
    }
    tasks[num - 1] = text;
  }
  return { tasks, errors };
}

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
  const [nameEdits, setNameEdits] = useState({});
  const [wheelOpen, setWheelOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");

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
      const next = await postAdmin(pin, type, payload);
      setToast(msg || (next.log && next.log[0] && next.log[0].text) || "Done");
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

  if (!state) {
    if (error?.error === "store_not_configured") {
      return (
        <div className="app-shell">
          <div className="center-note">
            <h2 className="stamp-font">Almost there</h2>
            <p>{error.message}</p>
          </div>
        </div>
      );
    }
    if (error) {
      return (
        <div className="app-shell">
          <div className="center-note">
            <h2 className="stamp-font">Something's wrong</h2>
            <p>{error.message || "Couldn't load the game — please try again in a moment."}</p>
          </div>
        </div>
      );
    }
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
        <h2>Share with players</h2>
        <p className="status-note">Have people scan this to jump straight to the join screen.</p>
        <div className="qr-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/qr.svg" alt="QR code to join the game" width={200} height={200} />
        </div>
      </div>

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
        <h2>Chaos wheel</h2>
        <p className="status-note">Spin for a random effect, then apply it with a tap or two.</p>
        <button className="btn btn-primary btn-block" onClick={() => setWheelOpen(true)}>
          🎡 Spin the wheel
        </button>
      </div>

      {state.pendingPrompt && (
        <div className="admin-section">
          <h2>Live prompt</h2>
          {state.pendingPrompt.type === "gamble" && (
            <p className="status-note">
              Gamble: {state.teams[state.pendingPrompt.teamA].name} vs {state.teams[state.pendingPrompt.teamB].name}{" "}
              — {state.pendingPrompt.status === "resolved" ? "resolved" : "waiting on target team to accept"}
            </p>
          )}
          {state.pendingPrompt.type === "prisoners_dilemma" && (
            <p className="status-note">
              Prisoner's Dilemma — {state.pendingPrompt.status === "resolved" ? "resolved" : "voting open"}
              {state.pendingPrompt.status === "voting" &&
                ` (${Object.keys(state.pendingPrompt.votes || {}).length} votes so far)`}
            </p>
          )}
          <div className="admin-row">
            {state.pendingPrompt.type === "prisoners_dilemma" && state.pendingPrompt.status === "voting" && (
              <button className="btn btn-sm" onClick={() => run("resolvePrisonersDilemma", {}, null)}>
                Tally &amp; resolve
              </button>
            )}
            <button className="btn btn-sm btn-ghost" onClick={() => run("clearPrompt", {}, "Popup cleared")}>
              Clear popup
            </button>
          </div>
        </div>
      )}

      <div className="admin-section">
        <h2>Board</h2>

        <div style={{ marginBottom: 16, borderBottom: "2px dashed var(--ink-soft)", paddingBottom: 14 }}>
          <label className="field-label">Batch-load tasks — one per line, "square number;task text"</label>
          <textarea
            rows={5}
            placeholder={"1;Bring in the most unusual item\n2;Pop the balloons without using your hands\n3;..."}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
          />
          <button
            className="btn btn-sm"
            style={{ marginTop: 6 }}
            onClick={() => {
              const { tasks, errors } = parseBulkTasks(bulkText);
              const count = Object.keys(tasks).length;
              if (!count) {
                setToast(errors.length ? errors[0] : "Nothing to load");
                return;
              }
              run(
                "bulkSetTasks",
                { tasks },
                `Loaded ${count} task${count === 1 ? "" : "s"}${errors.length ? `, skipped ${errors.length}` : ""}`
              );
              if (!errors.length) setBulkText("");
            }}
          >
            Load tasks
          </button>
        </div>

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
            <button
              className="btn btn-sm"
              style={{ marginTop: 10, marginLeft: 8 }}
              title="Applies just the multiplier above to a random open square"
              onClick={() => run("randomMultiplier", { multiplier: editMultiplier }, null)}
            >
              Apply x{editMultiplier} randomly
            </button>
          </div>
        )}

        <div style={{ marginTop: 18, borderTop: "2px dashed var(--ink-soft)", paddingTop: 12 }}>
          <label className="field-label">Swap two squares (task, multiplier, reserved — not claims)</label>
          <div className="admin-row">
            <input
              type="number"
              min={1}
              max={BOARD_CELLS}
              placeholder="Square #"
              value={swapA}
              onChange={(e) => setSwapA(e.target.value)}
              style={{ width: 90 }}
            />
            <span>⇄</span>
            <input
              type="number"
              min={1}
              max={BOARD_CELLS}
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
                if (a < 0 || a >= BOARD_CELLS || b < 0 || b >= BOARD_CELLS || a === b) {
                  setToast(`Pick two different squares 1–${BOARD_CELLS}`);
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
          <div key={team.id} style={{ marginBottom: 10 }}>
            <div className="admin-row" style={{ justifyContent: "space-between" }}>
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
            <div className="admin-row" style={{ marginTop: 4 }}>
              <input
                type="text"
                placeholder="Rename team"
                value={nameEdits[team.id] ?? ""}
                onChange={(e) => setNameEdits({ ...nameEdits, [team.id]: e.target.value })}
                style={{ flex: 1, minWidth: 120 }}
              />
              <button
                className="btn btn-sm"
                onClick={() => {
                  const name = (nameEdits[team.id] || "").trim();
                  if (!name) return;
                  run("renameTeam", { teamId: team.id, name }, `Renamed to ${name}`);
                  setNameEdits({ ...nameEdits, [team.id]: "" });
                }}
              >
                Rename
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
      {wheelOpen && <WheelModal state={state} run={run} onClose={() => setWheelOpen(false)} />}
    </div>
  );
}
