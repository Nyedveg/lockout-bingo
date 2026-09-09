"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const FAST_POLL_MS = 2000; // while waiting for the clock to start (or resume from a pause)
const SLOW_POLL_MS = 6000; // once it's actually running

export function useGameState() {
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const timeoutRef = useRef(null);
  const stateRef = useRef(null);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data);
        return;
      }
      setError(null);
      setState(data);
      stateRef.current = data;
    } catch (e) {
      setError({ error: "network_error", message: "Can't reach the server." });
    }
  }, []);

  useEffect(() => {
    function nextDelay() {
      const timer = stateRef.current && stateRef.current.timer;
      // Fast whenever the clock isn't actively counting down — covers
      // both "hasn't started yet" and "admin just paused it" — so the
      // moment it starts or resumes, everyone's board unlocks within a
      // couple seconds instead of being stuck on stale data for up to
      // the full slow-poll interval.
      return timer && timer.running ? SLOW_POLL_MS : FAST_POLL_MS;
    }

    function clearScheduled() {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }

    function scheduleNext() {
      clearScheduled();
      timeoutRef.current = setTimeout(async () => {
        await fetchState();
        scheduleNext();
      }, nextDelay());
    }

    fetchState().then(scheduleNext);

    // A locked/backgrounded phone doesn't need to keep polling — pause
    // entirely while hidden, and catch up immediately (rescheduling at
    // whatever speed is now appropriate) the moment it's looked at again.
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        fetchState().then(scheduleNext);
      } else {
        clearScheduled();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearScheduled();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchState]);

  return { state, error, refresh: fetchState, applyState: setState };
}

export async function postAction(teamId, cellId) {
  const res = await fetch("/api/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ teamId, cellId }),
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.message || "Action failed"), { code: data.error });
  return data;
}

export async function postRoster(clientId, teamId, name) {
  const res = await fetch("/api/roster", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, teamId, name }),
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.message || "Couldn't join"), { code: data.error });
  return data;
}

export async function postPrompt(type, clientId, teamId, choice) {
  const res = await fetch("/api/prompt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, clientId, teamId, choice }),
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.message || "Action failed"), { code: data.error });
  return data;
}

export async function postAdmin(pin, type, payload) {
  const res = await fetch("/api/admin", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-pin": pin },
    body: JSON.stringify({ type, payload }),
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.message || "Action failed"), { code: data.error, status: res.status });
  return data;
}
