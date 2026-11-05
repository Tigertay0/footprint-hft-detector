"use client";
// Hero sequence (plays once): a wide minute price line draws under the headline (Round's product rising out of the
// hero), the push turns amber, it snaps back, and one real early warning from the 8 October feed drops onto the card.
import { motion, useReducedMotion } from "motion/react";
import { NotificationCard, type FeedItem } from "./ui/NotificationCard";

const W = 1000;
const H = 300;
const N = 96;
const X0 = 24;
const X1 = W - 24;
const PUSH = [60, 67] as const;
const REVERT_END = 74;
const VOL_TOP = 228;
const VOL_BASE = 288;

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const rand = seeded(7);
const prices: number[] = [];
let p = 100;
for (let i = 0; i < N; i++) {
  if (i > PUSH[0] && i <= PUSH[1]) p += 0.5 + rand() * 0.25;
  else if (i > PUSH[1] && i <= REVERT_END) p -= 0.38 + rand() * 0.2;
  else p += (rand() - 0.5) * 0.34;
  prices.push(p);
}
const hot = (i: number) => i >= PUSH[0] - 2 && i <= PUSH[1];
const volumes = prices.map((_, i) => {
  if (hot(i)) return 0.75 + rand() * 0.25;
  if (i > PUSH[1] && i <= REVERT_END) return 0.4 + rand() * 0.2;
  return 0.16 + rand() * 0.22;
});

const min = Math.min(...prices) - 0.5;
const max = Math.max(...prices) + 0.5;
const x = (i: number) => X0 + (i / (N - 1)) * (X1 - X0);
const y = (v: number) => 24 + (1 - (v - min) / (max - min)) * 180;
const path = (from: number, to: number) =>
  prices
    .slice(from, to + 1)
    .map((v, k) => `${k === 0 ? "M" : "L"}${x(from + k).toFixed(1)},${y(v).toFixed(1)}`)
    .join(" ");

const BEFORE = path(0, PUSH[0]);
const PUSHED = path(PUSH[0], PUSH[1]);
const AFTER = path(PUSH[1], N - 1);
const BAR_W = ((X1 - X0) / N) * 0.6;
const ease = [0.16, 1, 0.3, 1] as const;

interface HeroFigureProps {
  label: string;
  tag: string;
  card: FeedItem;
  appLabel: string;
  timeLabel: string;
}

export function HeroFigure({ label, tag, card, appLabel, timeLabel }: HeroFigureProps) {
  const reduce = useReducedMotion();
  const t = (delay: number, duration: number) => (reduce ? { duration: 0 } : { delay, duration, ease });
  const peakX = (x(PUSH[1]) / W) * 100;

  return (
    <figure className="relative mx-auto w-full max-w-[1048px] pt-24 sm:pt-16">
      <div className="relative rounded-xl border border-rule bg-paper px-3 pb-3 pt-10 shadow-[var(--shadow-card)] sm:px-5">
        <p className="absolute left-5 top-4 text-[14px] text-graphite">{tag}</p>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="block h-auto w-full">
          {[0, 1, 2, 3].map((k) => (
            <line key={k} x1={X0} x2={X1} y1={24 + k * 60} y2={24 + k * 60} stroke="var(--color-rule)" strokeWidth="1" />
          ))}
          {volumes.map((v, i) => (
            <motion.rect
              key={i}
              x={x(i) - BAR_W / 2}
              y={VOL_BASE - v * (VOL_BASE - VOL_TOP)}
              width={BAR_W}
              height={v * (VOL_BASE - VOL_TOP)}
              rx="1"
              fill={hot(i) ? "var(--color-amber)" : "var(--color-rule)"}
              opacity={hot(i) ? 0.85 : 1}
              style={{ originY: 1, transformBox: "fill-box" }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={t(0.2 + i * 0.008, 0.4)}
            />
          ))}
          <motion.path d={BEFORE} fill="none" stroke="var(--color-ink)" strokeWidth="2" strokeLinejoin="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={t(0.3, 0.9)} />
          <motion.path d={PUSHED} fill="none" stroke="var(--color-amber)" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={t(1.2, 0.25)} />
          <motion.path d={AFTER} fill="none" stroke="var(--color-ink)" strokeWidth="2" strokeLinejoin="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={t(1.45, 0.45)} />
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={t(1.3, 0.3)}>
            <circle cx={x(PUSH[1])} cy={y(prices[PUSH[1]])} r="6" fill="var(--color-amber)" />
            <circle cx={x(PUSH[1])} cy={y(prices[PUSH[1]])} r="13" fill="none" stroke="var(--color-amber)" strokeOpacity=".4" />
          </motion.g>
        </svg>
      </div>
      <motion.div
        className="absolute right-3 top-0 w-[min(320px,calc(100%-24px))] sm:right-[calc(100%-var(--peak)+40px)]"
        style={{ "--peak": `${Math.min(peakX, 76)}%` } as React.CSSProperties}
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={reduce ? { duration: 0 } : { delay: 1.55, duration: 0.4, ease }}
      >
        <NotificationCard item={card} appLabel={appLabel} timeLabel={timeLabel} full className="shadow-[0_12px_32px_rgba(23,24,28,.18)] ring-1 ring-black/5" />
      </motion.div>
    </figure>
  );
}
