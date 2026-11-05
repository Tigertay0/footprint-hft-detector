"use client";
import { useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";

/** A ref plus "has it been seen" (once), and whether motion should be skipped. */
export function useReveal<T extends Element>(amount = 0.4) {
  const ref = useRef<T>(null);
  const seen = useInView(ref, { once: true, amount });
  const reduce = useReducedMotion() ?? false;
  return { ref, seen: seen || reduce, reduce };
}

export const EASE = [0.16, 1, 0.3, 1] as const;
