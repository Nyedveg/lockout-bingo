"use client";

import { useLayoutEffect, useRef, useState } from "react";

// Largest-to-smallest candidate sizes (px). Starts noticeably bigger than
// before so multipliers/short tasks read clearly; steps down only as far
// as a given cell's own text needs to avoid clipping.
const SIZES = [17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7];

export default function FitText({ text }) {
  const boxRef = useRef(null);
  const textRef = useRef(null);
  const [size, setSize] = useState(SIZES[0]);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const span = textRef.current;
    if (!box || !span) return;
    let i = 0;
    span.style.fontSize = SIZES[i] + "px";
    // Measure the FIXED-SIZE box (not the auto-sizing span) for overflow —
    // the box has a real clientHeight/clientWidth from its CSS layout,
    // while the span inside naturally grows past it when text is too big,
    // which is exactly what makes scrollHeight/scrollWidth exceed it.
    while (
      i < SIZES.length - 1 &&
      (box.scrollHeight > box.clientHeight + 1 || box.scrollWidth > box.clientWidth + 1)
    ) {
      i += 1;
      span.style.fontSize = SIZES[i] + "px";
    }
    setSize(SIZES[i]);
  }, [text]);

  return (
    <div ref={boxRef} className="cell-text-wrap">
      <span ref={textRef} className="fit-text" style={{ fontSize: size }}>
        {text}
      </span>
    </div>
  );
}
