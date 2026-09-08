"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const POLL_MS = 3000;

export function useGameState() {
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);

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
    } catch (e) {
      setError({ error: "network_error", message: "Can't reach the server." });
    }
  }, []);

  useEffect(() => {
    fetchState();
    timerRef.current = setInterval(fetchState, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchState();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timerRef.current);
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
