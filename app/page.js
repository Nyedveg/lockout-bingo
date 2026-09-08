"use client";

import { useEffect, useState } from "react";
import { useGameState, postAction, postRoster } from "./hooks/useGameState";
import TeamSelect from "./components/TeamSelect";
import TimerDisplay from "./components/TimerDisplay";
import Scoreboard from "./components/Scoreboard";
import BoardGrid from "./components/BoardGrid";
import ActivityFeed from "./components/ActivityFeed";
import Toast from "./components/Toast";
import RosterMenu from "./components/RosterMenu";

const TEAM_KEY = "lb_team_id";
const NAME_KEY = "lb_name";
const CLIENT_KEY = "lb_client_id";

function getOrCreateClientId() {
  let id = localStorage.getItem(CLIENT_KEY);
  if (!id) {
    id = window.crypto?.randomUUID
      ? window.crypto.randomUUID()
      : `c_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(CLIENT_KEY, id);
  }
  return id;
}

export default function Home() {
  const { state, error, applyState } = useGameState();
  const [myTeamId, setMyTeamId] = useState(null);
  const [clientId, setClientId] = useState(null);
  const [name, setName] = useState("");
  const [joining, setJoining] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    setClientId(getOrCreateClientId());
    const savedTeam = Number(localStorage.getItem(TEAM_KEY));
    if (savedTeam) setMyTeamId(savedTeam);
    const savedName = localStorage.getItem(NAME_KEY);
    if (savedName) setName(savedName);
  }, []);

  async function chooseTeam(teamId) {
    if (!clientId || !name.trim() || joining) return;
    setJoining(true);
    try {
      const next = await postRoster(clientId, teamId, name.trim());
      applyState(next);
      localStorage.setItem(TEAM_KEY, String(teamId));
      localStorage.setItem(NAME_KEY, name.trim());
      setMyTeamId(teamId);
    } catch (e) {
      setToast(e.message || "Couldn't join — try again");
    } finally {
      setJoining(false);
    }
  }

  function switchTeam() {
    localStorage.removeItem(TEAM_KEY);
    setMyTeamId(null);
  }

  async function handleToggle(cellId) {
    const next = await postAction(myTeamId, cellId);
    applyState(next);
    return next;
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
        <div className="center-note">Loading the board…</div>
      </div>
    );
  }

  const gameStarted = state.timer.running || state.timer.remainingSeconds < state.timer.durationSeconds;

  return (
    <div className="app-shell">
      <header className="masthead">
        <RosterMenu teams={state.teams} roster={state.roster} />
        <h1>Lockout Bingo</h1>
        <div className="tagline">Your time starts now.</div>
        {myTeamId && (
          <div className="team-pill-row">
            <span className="team-pill" style={{ "--tc": state.teams[myTeamId].color }}>
              <span className="team-dot" />
              {state.teams[myTeamId].name}
            </span>
            <button className="link-btn" onClick={switchTeam}>
              switch team
            </button>
          </div>
        )}
      </header>

      {!myTeamId ? (
        <TeamSelect teams={state.teams} name={name} onNameChange={setName} onSelect={chooseTeam} joining={joining} />
      ) : (
        <>
          <TimerDisplay timer={state.timer} />
          <Scoreboard teams={state.teams} myTeamId={myTeamId} />
          <BoardGrid
            board={state.board}
            teams={state.teams}
            myTeamId={myTeamId}
            gameStarted={gameStarted}
            onToggle={handleToggle}
            onToast={setToast}
          />
          <ActivityFeed log={state.log} />
        </>
      )}

      <Toast message={toast} onDone={() => setToast("")} />
    </div>
  );
}
