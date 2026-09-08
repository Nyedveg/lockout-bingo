"use client";

import { useEffect, useRef, useState } from "react";
import FitText from "./FitText";

const HOLD_MS = 1000;

export default function BoardGrid({ board, teams, myTeamId, gameStarted, blinded, onToggle, onToast }) {
  const [holdingId, setHoldingId] = useState(null);
  const [pendingId, setPendingId] = useState(null);
  const timerRef = useRef(null);

  // Safety net: cancel any in-flight hold timer if the component unmounts
  // (e.g. the player switches teams) while a press is in progress.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function cancelHold() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setHoldingId(null);
  }

  function beginHold(cell) {
    if (holdingId !== null || pendingId !== null) return;

    const isMine = cell.claimedBy === myTeamId;
    if (!gameStarted) {
      onToast("The Taskmaster hasn't started the clock yet.");
      return;
    }
    if (cell.claimedBy && !isMine) {
      onToast(`Already claimed by ${teams[cell.claimedBy].name}`);
      return;
    }
    if (!isMine && cell.reservedFor && cell.reservedFor !== myTeamId) {
      onToast("Reserved for another team right now");
      return;
    }

    setHoldingId(cell.id);
    timerRef.current = setTimeout(async () => {
      timerRef.current = null;
      setHoldingId(null);
      setPendingId(cell.id);
      try {
        await onToggle(cell.id);
        onToast(isMine ? "Claim removed" : `Claimed for ${teams[myTeamId].name}!`);
      } catch (e) {
        onToast(e.message || "Couldn't update that square");
      } finally {
        setPendingId(null);
      }
    }, HOLD_MS);
  }

  function handlePointerDown(e, cell) {
    if (e.pointerType === "mouse" && e.button !== 0) return; // left click / touch / pen only
    e.currentTarget.setPointerCapture?.(e.pointerId);
    beginHold(cell);
  }

  return (
    <div className="board-grid">
      {board.map((cell) => {
        const owner = cell.claimedBy ? teams[cell.claimedBy] : null;
        const isMine = cell.claimedBy === myTeamId;
        const reservedForMe = !cell.claimedBy && cell.reservedFor === myTeamId;
        const isHolding = holdingId === cell.id;
        const classes = [
          "cell",
          owner ? "claimed" : "",
          cell.reservedFor ? "reserved" : "",
          pendingId === cell.id ? "pending" : "",
          isHolding ? "holding" : "",
        ]
          .filter(Boolean)
          .join(" ");
        const holdFillColor = isMine ? "var(--ink)" : teams[myTeamId] && teams[myTeamId].color;

        return (
          <button
            key={cell.id}
            className={classes}
            style={{ "--tc": owner ? owner.color : reservedForMe ? teams[myTeamId].color : "var(--gold)" }}
            onPointerDown={(e) => handlePointerDown(e, cell)}
            onPointerUp={cancelHold}
            onPointerCancel={cancelHold}
            onPointerLeave={cancelHold}
            onContextMenu={(e) => e.preventDefault()}
            aria-label={`Square ${cell.id + 1}: ${blinded ? "hidden by a curse" : cell.task}${
              owner ? `, claimed by ${owner.name}` : ""
            }. Press and hold for 1 second to ${isMine ? "remove your claim" : "claim"}.`}
          >
            <div className="hold-fill" style={{ background: holdFillColor }} />
            <div className="badges">
              <span>{cell.id + 1}</span>
              <span className="badge-right">
                {cell.multiplier > 1 ? <span className="badge-chip badge-mult">x{cell.multiplier}</span> : null}
                {cell.reservedFor ? <span className="badge-chip badge-lock">🔒</span> : null}
              </span>
            </div>
            {blinded ? (
              <div className="cell-text-wrap">
                <span className="cell-blinded">🙈 Hidden by a curse</span>
              </div>
            ) : (
              <FitText text={cell.task} />
            )}
            {owner && (
              <span className="claimed-by">
                {owner.name}
                {isMine ? " · hold to undo" : ""}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
