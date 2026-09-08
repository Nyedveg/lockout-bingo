"use client";

import { useLayoutEffect, useRef, useState } from "react";

// Largest-to-smallest candidate sizes (px). Starts noticeably bigger than
// before so multipliers/short tasks read clearly; steps down only as far
// as a given cell's own text needs to avoid clipping.
const SIZES = [17, 16, 15, 14, 13, 12, 11, 10, 9, 8];

export default function FitText({ text }) {
  const ref = useRef(null);
  const [size, setSize] = useState(SIZES[0]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let i = 0;
    el.style.fontSize = SIZES[i] + "px";
    while (
      i < SIZES.length - 1 &&
      (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)
    ) {
      i += 1;
      el.style.fontSize = SIZES[i] + "px";
    }
    setSize(SIZES[i]);
  }, [text]);

  return (
    <span ref={ref} className="fit-text" style={{ fontSize: size }}>
      {text}
    </span>
  );
}
