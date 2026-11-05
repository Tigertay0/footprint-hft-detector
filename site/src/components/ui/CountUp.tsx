"use client";
// Number that counts up once when it enters the viewport. Adapted from unlumen's Count Up (21st.dev id 20068):
// Zodiak tabular figures, no blur, locale separators. The final value is in the HTML for no-JS and reduced motion.
import { animate, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { formatNumber } from "@/lib/utils";

interface CountUpProps {
  value: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  locale: string;
  duration?: number;
  className?: string;
}

export function CountUp({ value, decimals = 0, suffix = "", prefix = "", locale, duration = 0.9, className }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();
  const final = `${prefix}${formatNumber(value, locale, decimals)}${suffix}`;

  useEffect(() => {
    const el = ref.current;
    if (!el || !inView || reduce) return;
    const controls = animate(0, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        el.textContent = `${prefix}${formatNumber(v, locale, decimals)}${suffix}`;
      },
    });
    return () => controls.stop();
  }, [inView, reduce, value, decimals, suffix, prefix, locale, duration]);

  return (
    <span ref={ref} className={`tabular ${className ?? ""}`}>
      {final}
    </span>
  );
}
