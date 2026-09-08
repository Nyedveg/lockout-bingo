"use client";

export default function TeamSelect({ teams, name, onNameChange, onSelect, joining }) {
  const canJoin = name.trim().length > 0 && !joining;

  return (
    <div>
      <p className="status-note" style={{ textAlign: "center" }}>
        Enter your name, then tap your team to join.
      </p>
      <input
        type="text"
        placeholder="Your name"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        maxLength={30}
        style={{ marginBottom: 14, textAlign: "center" }}
        autoFocus
      />
      <div className="team-select-grid">
        {Object.values(teams).map((team) => (
          <button
            key={team.id}
            className="team-card"
            style={{ "--tc": team.color }}
            disabled={!canJoin}
            onClick={() => onSelect(team.id)}
          >
            <div className="name">{team.name}</div>
            <div className="sub">Score so far: {team.score}</div>
          </button>
        ))}
      </div>
      {!name.trim() && (
        <p className="status-note" style={{ textAlign: "center", marginTop: 10 }}>
          Type your name first
        </p>
      )}
    </div>
  );
}
