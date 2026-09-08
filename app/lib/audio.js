"use client";

export const SOUNDS = {
  notification: "/sounds/notification.mp3",
  dropper: "/sounds/dropper.mp3",
  riser: "/sounds/riser.mp3",
  pop: "/sounds/pop.mp3",
};

const cache = {};

function getAudio(src) {
  if (typeof window === "undefined") return null;
  if (!cache[src]) {
    const audio = new Audio(src);
    audio.preload = "auto";
    cache[src] = audio;
  }
  return cache[src];
}

export function playSound(src) {
  const audio = getAudio(src);
  if (!audio) return;
  try {
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch {
    // ignore — e.g. blocked before any user gesture has happened yet
  }
}

export function stopSound(src) {
  const audio = cache[src];
  if (!audio) return;
  try {
    audio.pause();
    audio.currentTime = 0;
  } catch {
    // ignore
  }
}

// Stops whichever of the two hold-in-progress sounds might be playing —
// used both when a hold completes (about to play pop) and when it's
// cancelled early, since only one of riser/dropper is ever active at once.
export function stopHoldSounds() {
  stopSound(SOUNDS.riser);
  stopSound(SOUNDS.dropper);
}
