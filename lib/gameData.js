// Core game configuration for the Taskmaster Lockout Bingo party.
// Everything here is meant to be a friendly placeholder — swap tasks,
// team names and colors freely, or edit live from /admin once the
// game is running.

export const GAME_DURATION_SECONDS = 3 * 60 * 60; // 3 hours
export const BASE_POINTS = 1; // points for claiming a square (x multiplier)
export const LINE_BONUS = 5; // bonus points the first time a team completes a full line

export const ADMIN_PIN = process.env.ADMIN_PIN || "2468";

export const DEFAULT_TEAMS = [
  { id: 1, name: "Team Umpire", color: "#a8342a" }, // stamp red
  { id: 2, name: "Team Loophole", color: "#2b3a55" }, // ink navy
  { id: 3, name: "Team Prize Task", color: "#c68a2e" }, // mustard gold
];

// 25 placeholder challenges — a mix of real Taskmaster task titles
// (pulled from the show's task archive) and originals written in the
// same spirit. "prize" tasks are ones where you bring/produce an item
// rather than perform a live physical challenge — good to know if
// you're timing people at the party.
export const TASK_POOL = [
  { text: "Bring in the most unusual item", prize: true },
  { text: "Bring in the most impressive item", prize: true },
  { text: "Bring in the most meaningful item", prize: true },
  { text: "Bring in the most valuable item", prize: true },
  { text: "Bring in the most satisfying item", prize: true },
  { text: "Eat as much watermelon as possible in 3 minutes", prize: false },
  { text: "Buy a gift for the Taskmaster", prize: true },
  { text: "Pop the balloons without using your hands", prize: false },
  { text: "Make the best snowman (or best substitute — no snow allowed)", prize: false },
  { text: "Surprise the Taskmaster when they walk back in the room", prize: false },
  { text: "Create the best meal using only items already on the table", prize: false },
  { text: "Communicate a film title to your team using only gestures", prize: false },
  { text: "Move water from one cup to another using the most ridiculous method", prize: false },
  { text: "Do something that looks brilliant in slow motion", prize: false },
  { text: "Build the tallest freestanding structure using only bread", prize: false },
  { text: "Balance the most household items on your head at once", prize: false },
  { text: "Bring in the best battery-operated item", prize: true },
  { text: "Say as many items of clothing as possible, in alphabetical order, in 2 minutes", prize: false },
  { text: "Say as many five-letter words as possible in 90 seconds", prize: false },
  { text: "Make the Taskmaster laugh without saying a single word", prize: false },
  { text: "Build the tallest tower using only what's in your pockets", prize: false },
  { text: "Deliver a dramatic villain monologue about a household chore", prize: false },
  { text: "Guess the Taskmaster's age within 2 years — whole team loses a point if wrong", prize: false },
  { text: "Recreate a famous movie scene using only kitchen utensils as props", prize: false },
  { text: "Convince a stranger (politely) that you have a made-up job, for 60 seconds", prize: false },
];

export function buildBoardFromPool(pool = TASK_POOL) {
  // Deterministic order (no shuffle) so the admin's printed/handed-out
  // task cards can match the on-screen board 1:1. Shuffle client-side
  // once before launch if you want a random layout instead.
  return pool.slice(0, 25).map((task, index) => ({
    id: index,
    task: task.text,
    prize: !!task.prize,
    claimedBy: null, // team id or null
    claimedAt: null,
    multiplier: 1,
    reservedFor: null, // team id or null
  }));
}

// All 12 winning lines on a 5x5 board: 5 rows, 5 columns, 2 diagonals.
export const LINES = (() => {
  const lines = [];
  for (let r = 0; r < 5; r++) {
    lines.push([0, 1, 2, 3, 4].map((c) => r * 5 + c));
  }
  for (let c = 0; c < 5; c++) {
    lines.push([0, 1, 2, 3, 4].map((r) => r * 5 + c));
  }
  lines.push([0, 6, 12, 18, 24]);
  lines.push([4, 8, 12, 16, 20]);
  return lines;
})();

export function createInitialState() {
  const teams = {};
  for (const t of DEFAULT_TEAMS) {
    teams[t.id] = { id: t.id, name: t.name, color: t.color, score: 0, linesCompleted: 0 };
  }
  return {
    schemaVersion: 2,
    createdAt: Date.now(),
    board: buildBoardFromPool(),
    teams,
    linesAwarded: {}, // { [lineIndex]: teamId }
    timer: {
      durationSeconds: GAME_DURATION_SECONDS,
      startedAt: null, // epoch ms when current run started
      running: false,
      remainingSeconds: GAME_DURATION_SECONDS, // frozen remaining when paused
    },
    log: [], // { ts, text } — short rotating feed shown in the UI
    roster: {}, // { [clientId]: { name, teamId, joinedAt } } — who's on what team
    events: [], // full structured history for later export/visualization
  };
}

export function pushLog(state, text) {
  state.log = [{ ts: Date.now(), text }, ...state.log].slice(0, 20);
}

// Append-only structured event log — never rotated during a game, so it
// can be exported afterwards (see /api/events) and used to reconstruct
// the full timeline of what happened, in order, for a visualization.
// Every event gets: ts (epoch ms), type, row/col (derived from cellId
// when present), plus whatever extra fields the call site passes.
const MAX_EVENTS = 3000;

export function logEvent(state, type, fields = {}) {
  if (!state.events) state.events = [];
  const cellId = fields.cellId;
  const row = typeof cellId === "number" ? Math.floor(cellId / 5) : null;
  const col = typeof cellId === "number" ? cellId % 5 : null;
  state.events.push({ ts: Date.now(), type, row, col, ...fields });
  if (state.events.length > MAX_EVENTS) {
    state.events = state.events.slice(state.events.length - MAX_EVENTS);
  }
}
