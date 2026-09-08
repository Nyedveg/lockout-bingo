import { GAME_DURATION_SECONDS, pushLog, logEvent } from "./gameData";

// Returns whole seconds remaining right now, given a timer object.
export function computeRemainingSeconds(timer) {
  if (!timer.running) return timer.remainingSeconds;
  const elapsed = Math.floor((Date.now() - timer.startedAt) / 1000);
  return Math.max(0, timer.remainingSeconds - elapsed);
}

export function startTimer(state) {
  if (state.timer.running) return state;
  const remaining = computeRemainingSeconds(state.timer);
  if (remaining <= 0) return state;
  state.timer.running = true;
  state.timer.startedAt = Date.now();
  state.timer.remainingSeconds = remaining;
  pushLog(state, "The Taskmaster started the clock. Your time starts now.");
  logEvent(state, "timer_start", { remainingSeconds: remaining });
  return state;
}

export function pauseTimer(state) {
  if (!state.timer.running) return state;
  state.timer.remainingSeconds = computeRemainingSeconds(state.timer);
  state.timer.running = false;
  state.timer.startedAt = null;
  pushLog(state, "The clock was paused.");
  logEvent(state, "timer_pause", { remainingSeconds: state.timer.remainingSeconds });
  return state;
}

export function resetTimer(state) {
  state.timer.running = false;
  state.timer.startedAt = null;
  state.timer.remainingSeconds = GAME_DURATION_SECONDS;
  pushLog(state, "The clock was reset to 3:00:00.");
  logEvent(state, "timer_reset", {});
  return state;
}
