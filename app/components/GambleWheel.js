"use client";

import { useEffect, useState } from "react";

export default function GambleWheel({ teamA, teamB, winnerIsA, isTie, onDone }) {
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (isTie) {
      const t = setTimeout(onDone, 1400);
      return () => clearTimeout(t);
    }
    // Segment A occupies the right half [0,180), segment B the left half
    // [180,360) of the wheel, matching conic-gradient's clockwise-from-top
    // convention. Land the pointer (fixed at top) on the predetermined
    // winner's half after a few full spins.
    const mid = winnerIsA ? 90 : 270;
    const baseR = (360 - mid + 360) % 360;
    const spins = 4;
    setRotation(spins * 360 + baseR);
    const t = setTimeout(onDone, 3400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isTie) {
    return <p className="status-note">Rolling… it's a tie!</p>;
  }

  const gradient = `${teamA.color} 0deg 180deg, ${teamB.color} 180deg 360deg`;

  return (
    <div>
      <div className="mini-wheel-caption">
        <span style={{ color: teamA.color }}>● {teamA.name}</span>
        <span style={{ color: teamB.color }}>{teamB.name} ●</span>
      </div>
      <div className="mini-wheel-wrap">
        <div className="mini-wheel-pointer" />
        <div
          className="mini-wheel-face"
          style={{ background: `conic-gradient(${gradient})`, transform: `rotate(${rotation}deg)` }}
        />
      </div>
    </div>
  );
}
