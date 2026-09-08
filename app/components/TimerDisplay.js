"use client";

import { useEffect, useState } from "react";

function fmt(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function TimerDisplay({ timer }) {
  const [display, setDisplay] = useState(timer.remainingSeconds);

  useEffect(() => {
    setDisplay(timer.remainingSeconds);
    if (!timer.running) return;
    const start = Date.now();
    const base = timer.remainingSeconds;
    const id = setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      setDisplay(Math.max(0, base - elapsed));
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer.remainingSeconds, timer.running]);

  let status = "Ready when you are";
  if (timer.running) status = "Your time starts now";
  else if (display === 0) status = "Time's up!";
  else if (display < timer.durationSeconds) status = "Paused";

  const cls = display <= 300 ? "critical" : display <= 900 ? "warn" : "";

  return (
    <div className="timer-card">
      <div className="timer-status">{status}</div>
      <div className={`timer-clock ${cls}`}>{fmt(display)}</div>
    </div>
  );
}
