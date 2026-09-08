"use client";

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function ActivityFeed({ log }) {
  if (!log || log.length === 0) return null;
  return (
    <div className="feed">
      <h3>What's happened</h3>
      <ul>
        {log.map((entry) => (
          <li key={entry.ts}>
            <span className="feed-time">{formatTime(entry.ts)}</span>
            {entry.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
