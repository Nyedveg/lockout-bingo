"use client";

import { useState } from "react";
import FitText from "./FitText";

export default function BoardGrid({ board, teams, myTeamId, gameStarted, blinded, onToggle, onToast }) {
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
            aria-label={`Square ${cell.id + 1}: ${blinded ? "hidden by a curse" : cell.task}${
              owner ? `, claimed by ${owner.name}` : ""
            }`}
          >
            <div className="badges">
              <span>{cell.id + 1}</span>
              <span className="badge-right">
                {cell.multiplier > 1 ? <span className="badge-chip badge-mult">x{cell.multiplier}</span> : null}
                {cell.reservedFor ? <span className="badge-chip badge-lock">🔒</span> : null}
              </span>
            </div>
            <div className="cell-text-wrap">
              {blinded ? <span className="cell-blinded">🙈 Hidden by a curse</span> : <FitText text={cell.task} />}
            </div>
            {owner && (
              <span className="claimed-by">
                {owner.name}
                {isMine ? " · tap to undo" : ""}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
