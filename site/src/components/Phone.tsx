"use client";
// The phone. Notification pile adapted from shadcnspace's Notification Stack Card (21st.dev id 43164):
// new alerts drop in at the top and older ones compress into a stack with a count. Driven by scroll, not timers.
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { NotificationCard, type FeedItem } from "./ui/NotificationCard";

export interface PhoneLabels {
  date: string;
  more: string; // "+{n} more"
  app: string;
  quiet: string;
  empty: string;
}

interface PhoneProps {
  items: FeedItem[];
  clock: string;
  labels: PhoneLabels;
  variant: "full" | "mini";
}

const FULL_SHOWN = 5;
const MINI_SHOWN = 3;

export function Phone({ items, clock, labels, variant }: PhoneProps) {
  const reduce = useReducedMotion();
  const shownCount = variant === "full" ? FULL_SHOWN : MINI_SHOWN;
  const newest = items.slice(-shownCount).reverse();
  const hidden = Math.max(0, items.length - shownCount);

  const list = (
    <ul className="relative grid gap-2">
      <AnimatePresence initial={false} mode="popLayout">
        {newest.map((it, i) => (
          <motion.li
            key={it.id ?? `${it.at}-${it.kind}-${it.ticker}-${i}`}
            layout={!reduce}
            initial={reduce ? false : { opacity: 0, y: -16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <NotificationCard item={it} appLabel={labels.app} compact={it.priority <= 2 || (variant === "mini" && i > 0)} />
          </motion.li>
        ))}
      </AnimatePresence>
      {hidden > 0 && (
        <li className="relative mx-auto mt-1 w-[92%]">
          <span aria-hidden className="absolute inset-x-3 -top-1 h-2 rounded-t-xl bg-white/25" />
          <span className="block rounded-xl bg-white/[0.14] px-3 py-2 text-center font-phone text-[12px] text-white/90 tabular">
            {labels.more.replace("{n}", String(hidden))}
          </span>
        </li>
      )}
    </ul>
  );

  if (variant === "mini") {
    return (
      <div className="overflow-hidden rounded-[22px] border border-night-rule bg-[#1c1d21] p-3">
        <div className="mb-2 flex items-baseline justify-between px-1 font-phone text-white">
          <span className="text-[22px] font-light tabular">{clock}</span>
          <span className="text-[12px] text-white/70">{labels.date}</span>
        </div>
        <div className="h-[208px] overflow-hidden">
          {items.length === 0 ? <p className="px-1 pt-2 font-phone text-[13px] text-night-text-2">{labels.empty}</p> : list}
        </div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto w-[300px] rounded-[44px] border border-[#3a3b40] bg-[#26272b] p-3 shadow-[var(--shadow-phone)]">
      <div className="relative h-[596px] overflow-hidden rounded-[32px] bg-[#17181c] px-3 pt-3">
        <div className="flex items-center justify-between px-3 font-phone text-[12px] text-white/85">
          <span className="tabular">{clock}</span>
          <span aria-hidden className="absolute left-1/2 top-3 h-5 w-20 -translate-x-1/2 rounded-full bg-black" />
          <span aria-hidden className="flex items-center gap-1">
            <svg width="14" height="10" viewBox="0 0 14 10" fill="currentColor"><rect x="0" y="6" width="2.4" height="4" rx=".5" /><rect x="3.8" y="4" width="2.4" height="6" rx=".5" /><rect x="7.6" y="2" width="2.4" height="8" rx=".5" /><rect x="11.4" y="0" width="2.4" height="10" rx=".5" /></svg>
            <svg width="20" height="10" viewBox="0 0 20 10" fill="none"><rect x=".5" y=".5" width="16" height="9" rx="2" stroke="currentColor" /><rect x="2" y="2" width="11" height="6" rx="1" fill="currentColor" /><rect x="17.5" y="3" width="1.5" height="4" rx=".5" fill="currentColor" /></svg>
          </span>
        </div>
        <div className="mt-6 text-center font-phone text-white">
          <p className="text-[64px] font-extralight leading-none tracking-[-0.02em] tabular">{clock}</p>
          <p className="mt-2 text-[13px] text-white/75">{labels.date}</p>
        </div>
        <div className="mt-5">
          {items.length === 0 ? <p className="text-center font-phone text-[13px] text-white/60">{labels.empty}</p> : list}
        </div>
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#17181c] to-transparent" />
        <span aria-hidden className="absolute bottom-2 left-1/2 h-1 w-24 -translate-x-1/2 rounded-full bg-white/60" />
      </div>
    </div>
  );
}
