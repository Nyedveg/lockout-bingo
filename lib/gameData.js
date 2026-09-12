// Core game configuration for the Taskmaster Lockout Bingo party.
// Everything here is meant to be a friendly placeholder — swap tasks,
// team names and colors freely, or edit live from /admin once the
// game is running.

export const GAME_DURATION_SECONDS = 2.5 * 60 * 60; // 2 hours 30 minutes
export const BASE_POINTS = 1; // points for claiming a square (x multiplier)
export const LINE_BONUS = 5; // bonus points the first time a team completes a full line

export const BOARD_SIZE = 6; // 6x6 board
export const BOARD_CELLS = BOARD_SIZE * BOARD_SIZE;

export const ADMIN_PIN = process.env.ADMIN_PIN || "2468";

export const BLINDNESS_MS = 15 * 60 * 1000;
export const TIME_DILATION_MS = 30 * 60 * 1000;
export const GAMBLE_STAKES = 3; // points won/lost on a Gamble wheel result
export const SPEED_ROUND_MS = 5 * 60 * 1000; // window for the next claim to score double
export const TALENT_SHOW_BONUS = 3; // points awarded to the Talent Show winner

// Simplified Prisoner's Dilemma payoff, applied pairwise between every
// pair of teams and summed. Tuned so mutual Silence beats mutual
// Snitching, but snitching alone still tempts.
export const PD_PAYOFF = {
  bothSilent: 2,
  bothSnitch: -1,
  snitchBonus: 3,
  silentPenalty: -2,
};

export const DEFAULT_TEAMS = [
  { id: 1, name: "Dr. Pepper", color: "#7a1f2b" }, // deep maroon red
  { id: 2, name: "Blu", color: "#2b3a55" }, // ink navy
  { id: 3, name: "Snek", color: "#123f2e" }, // phthalo green
];

// 36 placeholder challenges — a mix of real Taskmaster task titles
// (pulled from the show's task archive) and originals written in the
// same spirit. Replace these with your own from /admin whenever you're
// ready — the board will reflect it immediately.
export const TASK_POOL = [
  { text: "Bring in the most unusual item" },
  { text: "Bring in the most impressive item" },
  { text: "Bring in the most meaningful item" },
  { text: "Bring in the most valuable item" },
  { text: "Bring in the most satisfying item" },
  { text: "Eat as much watermelon as possible in 3 minutes" },
  { text: "Buy a gift for the Taskmaster" },
  { text: "Pop the balloons without using your hands" },
  { text: "Make the best snowman (or best substitute — no snow allowed)" },
  { text: "Surprise the Taskmaster when they walk back in the room" },
  { text: "Create the best meal using only items already on the table" },
  { text: "Communicate a film title to your team using only gestures" },
  { text: "Move water from one cup to another using the most ridiculous method" },
  { text: "Do something that looks brilliant in slow motion" },
  { text: "Build the tallest freestanding structure using only bread" },
  { text: "Balance the most household items on your head at once" },
  { text: "Bring in the best battery-operated item" },
  { text: "Say as many items of clothing as possible, in alphabetical order, in 2 minutes" },
  { text: "Say as many five-letter words as possible in 90 seconds" },
  { text: "Make the Taskmaster laugh without saying a single word" },
  { text: "Build the tallest tower using only what's in your pockets" },
  { text: "Deliver a dramatic villain monologue about a household chore" },
  { text: "Guess the Taskmaster's age within 2 years — whole team loses a point if wrong" },
  { text: "Recreate a famous movie scene using only kitchen utensils as props" },
  { text: "Convince a stranger (politely) that you have a made-up job, for 60 seconds" },
  { text: "Do the best impression of another team's captain" },
  { text: "Fold the most impressive paper airplane and land it in a container" },
  { text: "Invent a secret handshake and teach it to the whole team in 90 seconds" },
  { text: "Stack as many household objects as possible without them falling for 10 seconds" },
  { text: "Write and perform a 15-second jingle about the party" },
  { text: "Guess the number of items in a mystery container, closest without going over" },
  { text: "Walk in a straight line balancing a spoon on your nose for 10 steps" },
  { text: "Make the most convincing fake sneeze" },
  { text: "Come up with the best excuse for being late, on the spot" },
  { text: "Build a tiny hat out of found materials and model it" },
  { text: "Hold a plank while naming as many countries as possible in 30 seconds" },
];

export function buildBoardFromPool(pool = TASK_POOL) {
  // Deterministic order (no shuffle) so the admin's printed/handed-out
  // task cards can match the on-screen board 1:1. Shuffle client-side
  // once before launch if you want a random layout instead.
  return pool.slice(0, BOARD_CELLS).map((task, index) => ({
    id: index,
    task: task.text,
    claimedBy: null, // team id or null
    claimedAt: null,
    multiplier: 1,
    reservedFor: null, // team id or null
  }));
}

// All winning lines on the board: one per row, one per column, plus the
// two diagonals. Scales automatically with BOARD_SIZE.
export const LINES = (() => {
  const lines = [];
  const N = BOARD_SIZE;
  for (let r = 0; r < N; r++) {
    lines.push(Array.from({ length: N }, (_, c) => r * N + c));
  }
  for (let c = 0; c < N; c++) {
    lines.push(Array.from({ length: N }, (_, r) => r * N + c));
  }
  lines.push(Array.from({ length: N }, (_, i) => i * N + i));
  lines.push(Array.from({ length: N }, (_, i) => i * N + (N - 1 - i)));
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
    roster: {}, // { [clientId]: { name, teamId, joinedAt } } — who's on what team
    curses: {}, // { [teamId]: { blindUntil, timeDilationUntil } } — wheel debuffs
    pendingPrompt: null, // active Gamble / Prisoner's Dilemma popup, or null
    speedRound: null, // { expiresAt, consumed } — next claim in the window scores double
    // Note: `log` (the friendly narrative feed) and `events` (the
    // structured audit trail) deliberately aren't part of this "core"
    // shape — both live in their own spot in the database (see
    // lib/store.js) so routine polling never has to pay for them.
    // Mutators still call pushLog()/logEvent(), which append to
    // transient scratch arrays that lib/store.js adds to the draft
    // before each mutation and strips out (persisting them separately)
    // afterwards.
  };
}

// The friendly, narrative log — same treatment as logEvent() below: this
// just appends to an in-memory scratch list during a single mutation,
// and lib/store.js persists it separately (never as part of the polled
// core state, and no longer capped — the cap only existed because the
// old design had to ship the whole thing to every client on every poll).
export function pushLog(state, text) {
  const prev = Array.isArray(state.log) ? state.log : [];
  state.log = [{ ts: Date.now(), text }, ...prev];
}

// Append-only structured event log — used for the exportable audit trail
// (see /api/events). Lives in a completely separate spot in the database
// (see lib/store.js) so routine polling never has to pay for it — this
// function just appends to an in-memory scratch list during a single
// mutation; lib/store.js is what actually persists it afterwards.
export function logEvent(state, type, fields = {}) {
  if (!state.events) state.events = [];
  const cellId = fields.cellId;
  const row = typeof cellId === "number" ? Math.floor(cellId / BOARD_SIZE) : null;
  const col = typeof cellId === "number" ? cellId % BOARD_SIZE : null;
  state.events.push({ ts: Date.now(), type, row, col, ...fields });
}
