"use client";
// Marker sweep on key numbers. Adapted from danielpetho's Text Highlighter (21st.dev id 18772):
// one amber pass left to right when the number scrolls into view, once.
import { useEffect, useRef, useState } from "react";

export function Mark({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setOn(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -30% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <mark
      ref={ref}
      data-on={on}
      className="rounded-[2px] bg-transparent bg-[linear-gradient(color-mix(in_srgb,var(--color-amber)_24%,transparent),color-mix(in_srgb,var(--color-amber)_24%,transparent))] bg-no-repeat text-inherit [background-position:0_88%] [background-size:0%_0.92em] transition-[background-size] duration-700 ease-[var(--ease-premium)] data-[on=true]:[background-size:100%_0.92em] motion-reduce:[background-size:100%_0.92em] motion-reduce:transition-none [box-decoration-break:clone]"
    >
      {children}
    </mark>
  );
}
