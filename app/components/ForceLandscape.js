"use client";

import { useLayoutEffect } from "react";

export default function ForceLandscape() {
  useLayoutEffect(() => {
    document.documentElement.classList.add("force-landscape");

    // Best-effort native lock for installed PWAs on browsers that support
    // the Screen Orientation API (mainly Android Chrome). Silently ignored
    // where unsupported (e.g. iOS Safari) — the CSS rotation below is what
    // actually carries the "force" for everyone.
    try {
      const orientation = window.screen && window.screen.orientation;
      if (orientation && typeof orientation.lock === "function") {
        orientation.lock("landscape").catch(() => {});
      }
    } catch {
      // ignore
    }

    return () => {
      document.documentElement.classList.remove("force-landscape");
    };
  }, []);

  return null;
}
