"use client";

import { useEffect, useState } from "react";

const ROLL_MS = 1500;
const TICK_MS = 90;

export default function DiceRoll({ teamA, teamB, rollA, rollB, isTie, winnerIsA, onDone }) {
  const [displayA, setDisplayA] = useState(1);
  const [displayB, setDisplayB] = useState(1);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const tick = setInterval(() => {
      setDisplayA(1 + Math.floor(Math.random() * 6));
      setDisplayB(1 + Math.floor(Math.random() * 6));
    }, TICK_MS);
    const settle = setTimeout(() => {
      clearInterval(tick);
      setDisplayA(rollA);
      setDisplayB(rollB);
      setSettled(true);
      onDone && onDone();
    }, ROLL_MS);
    return () => {
      clearInterval(tick);
      clearTimeout(settle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="dice-row">
      <div
        className={`die${settled && winnerIsA ? " die-winner" : ""}`}
        style={{ "--tc": teamA.color }}
      >
        <span className="die-label">{teamA.name}</span>
        <span className="die-face">{settled ? rollA : displayA}</span>
      </div>
      <div className="dice-vs">{settled ? (isTie ? "tie" : "vs") : "vs"}</div>
      <div
        className={`die${settled && !isTie && !winnerIsA ? " die-winner" : ""}`}
        style={{ "--tc": teamB.color }}
      >
        <span className="die-label">{teamB.name}</span>
        <span className="die-face">{settled ? rollB : displayB}</span>
      </div>
    </div>
  );
}
