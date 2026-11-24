"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

/**
 * Custom doodle cursor:
 *  - Default  → Select-Cursor-Arrow (normal pointer)
 *  - Clicking → Cursor-Highlight-Click-2 (click/highlight)
 * Follows the mouse with a subtle easing lag.
 */
export default function CustomCursor() {
  const ref = useRef<HTMLDivElement>(null);
  const [clicking, setClicking] = useState(false);

  useEffect(() => {
    let raf: number;
    let mx = -200, my = -200;
    let rx = -200, ry = -200;

    const onMove = (e: MouseEvent) => { mx = e.clientX; my = e.clientY; };
    const onDown = () => setClicking(true);
    const onUp   = () => setClicking(false);

    const tick = () => {
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      if (ref.current) {
        ref.current.style.transform = `translate(${rx}px, ${ry}px)`;
      }
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove",  onMove, { passive: true });
    window.addEventListener("mousedown",  onDown, { passive: true });
    window.addEventListener("mouseup",    onUp,   { passive: true });
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup",   onUp);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 9999,
        pointerEvents: "none",
        /* hot-spot sits at the tip of the arrow / click icon */
        marginTop: "-4px",
        marginLeft: "-4px",
        willChange: "transform",
        transition: "opacity 80ms ease",
      }}
    >
       {/* Arrow cursor — shown when not clicking */}
       <Image
         src="/icons/Select-Cursor-Arrow--Streamline-Freehand.png"
         alt=""
         width={38}
         height={38}
         priority
         style={{
           display: "block",
           userSelect: "none",
           opacity: clicking ? 0 : 1,
           position: "absolute",
           top: 0,
           left: 0,
           transition: "opacity 150ms ease",
         }}
         draggable={false}
       />

       {/* Click cursor — shown on mousedown */}
       <Image
         src="/icons/Cursor-Highlight-Click-2--Streamline-Freehand.png"
         alt=""
         width={38}
         height={38}
         priority
         style={{
           display: "block",
           userSelect: "none",
           opacity: clicking ? 1 : 0,
           position: "absolute",
           top: 0,
           left: 0,
           transition: "opacity 150ms ease",
         }}
         draggable={false}
       />

      {/* Spacer so the div has dimensions matching the icons */}
      <span style={{ display: "block", width: 38, height: 38 }} />
    </div>
  );
}
