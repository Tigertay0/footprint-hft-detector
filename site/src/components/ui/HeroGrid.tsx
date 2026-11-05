"use client";
// Graph-paper ambient layer for the hero. Adapted from rmahammad's Animated Grid (21st.dev id 29376):
// CSS only, drifts one major cell every 40s, fades out radially, pauses when the hero is off screen.
import { useEffect, useRef, useState } from "react";

export function HeroGrid() {
  const ref = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setPaused(!e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="graph-paper" data-paused={paused} />
    </div>
  );
}
