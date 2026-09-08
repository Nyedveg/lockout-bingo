"use client";

import { useState } from "react";

export default function BoardGrid({ board, teams, myTeamId, gameStarted, onToggle, onToast }) {
  const [pendingId, setPendingId] = useState(null);

  async function handleTap(cell) {
    if (pendingId !== null) return;

    if (!gameStarted) {
      onToast("The Taskmaster hasn't started the clock yet.");
      return;
    }
    const isMine = cell.claimedBy === myTeamId;
    if (cell.claimedBy && !isMine) {
      onToast(`Already claimed by ${teams[cell.claimedBy].name}`);
      return;
    }
    if (!isMine && cell.reservedFor && cell.reservedFor !== myTeamId) {
      onToast("Reserved for another team right now");
      return;
    }

    setPendingId(cell.id);
    try {
      await onToggle(cell.id);
      onToast(isMine ? "Claim removed" : `Claimed for ${teams[myTeamId].name}!`);
    } catch (e) {
      onToast(e.message || "Couldn't update that square");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="board-grid">
      {board.map((cell) => {
        const owner = cell.claimedBy ? teams[cell.claimedBy] : null;
        const isMine = cell.claimedBy === myTeamId;
        const reservedForMe = !cell.claimedBy && cell.reservedFor === myTeamId;
        const classes = [
          "cell",
          owner ? "claimed" : "",
          cell.reservedFor ? "reserved" : "",
          pendingId === cell.id ? "pending" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <button
            key={cell.id}
            className={classes}
            style={{ "--tc": owner ? owner.color : reservedForMe ? teams[myTeamId].color : "var(--gold)" }}
            onClick={() => handleTap(cell)}
            aria-label={`Square ${cell.id + 1}: ${cell.task}${owner ? `, claimed by ${owner.name}` : ""}`}
          >
            <div className="badges">
              <span>{cell.id + 1}</span>
              <span>
                {cell.multiplier > 1 ? `x${cell.multiplier} ` : ""}
                {cell.reservedFor ? "🔒" : ""}
              </span>
            </div>
            <span className="cell-text">{cell.task}</span>
            {owner && (
              <span className="claimed-by">
                {owner.name}
                {isMine ? " · tap to undo" : ""}
              </span>
            )}
            {cell.prize && <span className="prize-star">★</span>}
          </button>
        );
      })}
    </div>
  );
}
