"use client";

export default function Scoreboard({ teams, myTeamId }) {
  const list = Object.values(teams).sort((a, b) => b.score - a.score);
  return (
    <div className="scoreboard">
      {list.map((team, i) => (
        <div
          key={team.id}
          className={`score-card${team.id === myTeamId ? " is-me" : ""}`}
          style={{ "--tc": team.color }}
        >
          {i === 0 && team.score > 0 && <span className="rank">👑</span>}
          <div className="team-name">{team.name}</div>
          <div className="score-num">{team.score}</div>
          <div className="lines">{team.linesCompleted} line{team.linesCompleted === 1 ? "" : "s"}</div>
        </div>
      ))}
    </div>
  );
}
