"use client";
// Word-by-word masked reveal, once. Adapted from soralabs' Text Reveal (Mask) (21st.dev id 19257).
import { motion } from "motion/react";
import { useReveal } from "@/lib/hooks";

export function TextReveal({ text, className }: { text: string; className?: string }) {
  const { ref, seen, reduce } = useReveal<HTMLParagraphElement>(0.5);
  const words = text.split(" ");
  return (
    <p ref={ref} className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {words.map((w, i) => (
          <span key={i} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
            <motion.span
              className="inline-block"
              initial={{ y: "105%" }}
              animate={{ y: seen ? "0%" : "105%" }}
              transition={reduce ? { duration: 0 } : { delay: i * 0.035, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              {w}
              {i < words.length - 1 ? " " : ""}
            </motion.span>
          </span>
        ))}
      </span>
    </p>
  );
}
