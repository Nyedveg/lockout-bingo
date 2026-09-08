"use client";

export default function ActivityFeed({ log }) {
  if (!log || log.length === 0) return null;
  return (
    <div className="feed">
      <h3>What's happened</h3>
      <ul>
        {log.map((entry) => (
          <li key={entry.ts}>{entry.text}</li>
        ))}
      </ul>
    </div>
  );
}
