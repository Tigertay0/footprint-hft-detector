"use client";
// Section 5-6 figures: the Isolation Forest by doing it, the three features, and the score you can build.
import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Locale } from "@/content/i18n";
import { EASE, useReveal } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { Figure } from "./Figure";

function seeded(seed: number) {
  let s = seed % 2147483647;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/* ---------------------------------------------------------------- Isolation Forest */

const IF_T = {
  en: {
    title: "Isolating a minute with random cuts",
    odd: "Odd minute",
    normal: "Ordinary minute",
    again: "Cut again",
    cuts: (k: number, done: boolean) => (done ? `Isolated after ${k} cut${k === 1 ? "" : "s"}` : `${k} cut${k === 1 ? "" : "s"} so far`),
    axisX: "trading volume",
    axisY: "size of the price move",
    caption: "Each dot is one minute. A cut splits the space at a random place; the forest keeps cutting the side that holds the chosen minute. Odd minutes are alone after a few cuts, ordinary ones need many. The average number of cuts, over many random trees, is the anomaly score.",
  },
  fr: {
    title: "Isoler une minute par des coupes au hasard",
    odd: "Minute étrange",
    normal: "Minute ordinaire",
    again: "Couper à nouveau",
    cuts: (k: number, done: boolean) => (done ? `Isolée après ${k} coupe${k > 1 ? "s" : ""}` : `${k} coupe${k > 1 ? "s" : ""} pour l'instant`),
    axisX: "volume échangé",
    axisY: "taille du mouvement de prix",
    caption: "Chaque point est une minute. Une coupe sépare l'espace à un endroit au hasard ; la forêt continue de couper le côté qui contient la minute choisie. Les minutes étranges sont seules après quelques coupes, les ordinaires en demandent beaucoup. Le nombre moyen de coupes, sur de nombreux arbres au hasard, donne le score d'anomalie.",
  },
};

interface Pt { x: number; y: number }
interface Box { x0: number; x1: number; y0: number; y1: number }
interface Cut { axis: "x" | "y"; v: number; box: Box }

const PTS: Pt[] = (() => {
  const r = seeded(11);
  const g = () => (r() + r() + r() - 1.5) / 1.5;
  const pts: Pt[] = [];
  for (let i = 0; i < 70; i++) pts.push({ x: 0.36 + g() * 0.22, y: 0.4 + g() * 0.22 });
  pts.push({ x: 0.9, y: 0.88 });
  return pts;
})();
const ODD = PTS.length - 1;
const NORMAL = (() => {
  let best = 0;
  let d = Infinity;
  PTS.forEach((p, i) => {
    const dd = (p.x - 0.36) ** 2 + (p.y - 0.4) ** 2;
    if (i !== ODD && dd < d) {
      d = dd;
      best = i;
    }
  });
  return best;
})();

function isolate(target: number, seed: number): Cut[] {
  const r = seeded(seed);
  let box: Box = { x0: 0, x1: 1, y0: 0, y1: 1 };
  let inside = PTS.map((_, i) => i);
  const cuts: Cut[] = [];
  let guard = 0;
  while (inside.length > 1 && cuts.length < 40 && guard++ < 400) {
    const axis = r() < 0.5 ? "x" : "y";
    const lo = Math.min(...inside.map((i) => PTS[i][axis]));
    const hi = Math.max(...inside.map((i) => PTS[i][axis]));
    if (hi - lo < 1e-6) continue;
    const v = lo + r() * (hi - lo);
    cuts.push({ axis, v, box });
    const t = PTS[target][axis];
    box = axis === "x" ? (t < v ? { ...box, x1: v } : { ...box, x0: v }) : t < v ? { ...box, y1: v } : { ...box, y0: v };
    inside = inside.filter((i) => (PTS[i][axis] < v) === (t < v));
  }
  return cuts;
}

const S = 300;

export function IForestFigure({ locale, n }: { locale: Locale; n: string }) {
  const t = IF_T[locale];
  const { ref, seen, reduce } = useReveal<HTMLDivElement>(0.5);
  const [target, setTarget] = useState<number>(ODD);
  const [seed, setSeed] = useState(3);
  const [shown, setShown] = useState(0);
  const [manual, setManual] = useState(false);
  const cuts = useMemo(() => isolate(target, seed), [target, seed]);
  const timer = useRef<number | undefined>(undefined);

  const play = useCallback(() => {
    window.clearInterval(timer.current);
    if (reduce) {
      setShown(cuts.length);
      return;
    }
    setShown(0);
    timer.current = window.setInterval(() => {
      setShown((k) => {
        if (k + 1 >= cuts.length) window.clearInterval(timer.current);
        return Math.min(k + 1, cuts.length);
      });
    }, 360);
  }, [cuts, reduce]);

  useEffect(() => {
    if (seen || manual) play();
    return () => window.clearInterval(timer.current);
  }, [seen, manual, play]);

  const k = Math.min(shown, cuts.length);
  const box = k === 0 ? { x0: 0, x1: 1, y0: 0, y1: 1 } : (() => {
    const last = cuts[k - 1];
    if (!last) return { x0: 0, x1: 1, y0: 0, y1: 1 };
    const tp = PTS[target];
    const b = last.box;
    return last.axis === "x" ? (tp.x < last.v ? { ...b, x1: last.v } : { ...b, x0: last.v }) : tp.y < last.v ? { ...b, y1: last.v } : { ...b, y0: last.v };
  })();
  const inBox = (p: Pt) => p.x >= box.x0 && p.x <= box.x1 && p.y >= box.y0 && p.y <= box.y1;
  const done = k === cuts.length && cuts.length > 0;
  const X = (v: number) => 10 + v * (S - 20);
  const Y = (v: number) => S - 10 - v * (S - 20);

  return (
    <Figure label={n} title={t.title} caption={t.caption}>
      <div ref={ref} className="grid gap-5 sm:grid-cols-[minmax(0,300px)_1fr] sm:items-start">
        <div>
          <svg viewBox={`0 0 ${S} ${S}`} className="h-auto w-full rounded-lg bg-newsprint" aria-hidden>
            <rect x={X(box.x0)} y={Y(box.y1)} width={X(box.x1) - X(box.x0)} height={Y(box.y0) - Y(box.y1)} fill="var(--color-amber)" fillOpacity=".08" />
            {cuts.slice(0, k).map((c, i) =>
              c.axis === "x" ? (
                <motion.line key={`${seed}-${i}`} x1={X(c.v)} x2={X(c.v)} y1={Y(c.box.y0)} y2={Y(c.box.y1)} stroke="var(--color-graphite)" strokeWidth="1.25"
                  initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.3, ease: EASE }} />
              ) : (
                <motion.line key={`${seed}-${i}`} x1={X(c.box.x0)} x2={X(c.box.x1)} y1={Y(c.v)} y2={Y(c.v)} stroke="var(--color-graphite)" strokeWidth="1.25"
                  initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.3, ease: EASE }} />
              ),
            )}
            {PTS.map((p, i) => (
              <circle key={i} cx={X(p.x)} cy={Y(p.y)} r={i === target ? 6 : 3.5}
                fill={i === target ? "var(--color-amber)" : "var(--color-ink)"} opacity={i === target ? 1 : inBox(p) ? 0.7 : 0.15}
                style={{ transition: "opacity 300ms" }} />
            ))}
          </svg>
          <div className="mt-1 flex justify-between text-[12px] text-ash">
            <span>↑ {t.axisY}</span>
            <span>{t.axisX} →</span>
          </div>
        </div>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-2">
            {[{ id: ODD, label: t.odd }, { id: NORMAL, label: t.normal }].map((o) => (
              <button
                key={o.id}
                type="button"
                aria-pressed={target === o.id}
                onClick={() => { setShown(0); setManual(true); setTarget(o.id); setSeed((s) => s + 1); }}
                className="btn-key px-3 text-[14px]"
              >
                {o.label}
              </button>
            ))}
          </div>
          <p className="font-display text-[clamp(28px,3vw,36px)] leading-tight tracking-[-0.01em]">
            {t.cuts(k, done)}
          </p>
          <p aria-live="polite" className="sr-only">{done ? t.cuts(k, true) : ""}</p>
          <button
            type="button"
            onClick={() => { setShown(0); setManual(true); setSeed((s) => s + 1); }}
            className="btn-key justify-self-start text-[15px]"
          >
            {t.again}
          </button>
        </div>
      </div>
    </Figure>
  );
}

/* ---------------------------------------------------------------- Features */

const F_T = {
  en: {
    title: "Three numbers for every minute",
    items: [
      { name: "Volume z-score", plain: "How far this minute's volume sits above the last 20 minutes. The rule fires above 2.5." },
      { name: "Price reversion", plain: "After a sharp 3-minute move, the share given back in the next 5 minutes. The rule fires above half." },
      { name: "Order imbalance", plain: "Where bars closed inside their high-low range, from −1 (at the low) to +1 (at the high). The rule fires beyond 0.6." },
    ],
    threshold: "2.5",
    back: "given back",
    caption: "Each number matches one step of the momentum ignition pattern: a burst of trading, a push and a reversal, one-sided pressure",
  },
  fr: {
    title: "Trois chiffres pour chaque minute",
    items: [
      { name: "Z-score du volume", plain: "L'écart entre le volume de la minute et celui des 20 minutes précédentes. La règle se déclenche au-dessus de 2,5." },
      { name: "Retour du prix", plain: "Après un mouvement brusque sur 3 minutes, la part rendue dans les 5 minutes suivantes. La règle se déclenche au-delà de la moitié." },
      { name: "Déséquilibre des ordres", plain: "Où les barres ont clôturé dans leur fourchette, de −1 (au plus bas) à +1 (au plus haut). La règle se déclenche au-delà de 0,6." },
    ],
    threshold: "2,5",
    back: "rendu",
    caption: "Chaque chiffre correspond à une étape de l'allumage de momentum : une rafale d'échanges, une poussée puis un retour, une pression d'un seul côté",
  },
};

export function FeaturesFigure({ locale, n }: { locale: Locale; n: string }) {
  const t = F_T[locale];
  const { ref, seen, reduce } = useReveal<HTMLDivElement>();
  const tr = (d: number, dur = 0.5) => (reduce ? { duration: 0 } : { delay: d, duration: dur, ease: EASE });
  const vols = [0.22, 0.3, 0.18, 0.26, 0.24, 0.2, 0.28, 0.25, 0.19, 0.23, 0.27, 0.21, 0.94];
  return (
    <Figure label={n} title={t.title} caption={t.caption}>
      <div ref={ref} className="grid gap-6 sm:grid-cols-3 sm:gap-4">
        <div>
          <div className="relative flex h-24 items-end gap-1 border-b border-rule">
            {vols.map((v, i) => (
              <motion.span key={i} className={cn("flex-1 origin-bottom rounded-t-[2px]", i === vols.length - 1 ? "bg-amber" : "bg-rule")}
                style={{ height: `${v * 100}%` }} initial={{ scaleY: 0 }} animate={{ scaleY: seen ? 1 : 0 }} transition={tr(i * 0.03)} />
            ))}
            <span className="absolute inset-x-0 border-t border-dashed border-amber-ink" style={{ bottom: "62%" }} />
            <span className="absolute right-0 rounded bg-paper px-1 font-mono text-[12px] text-amber-ink" style={{ bottom: "64%" }}>{t.threshold}</span>
          </div>
          <p className="mt-3 text-[15px] font-medium">{t.items[0].name}</p>
          <p className="mt-1 text-[14px] leading-snug text-graphite">{t.items[0].plain}</p>
        </div>
        <div>
          <div className="relative h-24 border-b border-rule">
            <svg viewBox="0 0 160 96" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
              <motion.path d="M0,80 L40,78 L70,18" fill="none" stroke="var(--color-amber)" strokeWidth="3" vectorEffect="non-scaling-stroke"
                initial={{ pathLength: 0 }} animate={{ pathLength: seen ? 1 : 0 }} transition={tr(0.1, 0.6)} />
              <motion.path d="M70,18 L105,52 L160,56" fill="none" stroke="var(--color-ink)" strokeWidth="2.5" vectorEffect="non-scaling-stroke"
                initial={{ pathLength: 0 }} animate={{ pathLength: seen ? 1 : 0 }} transition={tr(0.7, 0.6)} />
            </svg>
            <motion.span className="absolute right-1 top-[24%] rounded bg-paper px-1 font-mono text-[12px] text-ink"
              initial={{ opacity: 0 }} animate={{ opacity: seen ? 1 : 0 }} transition={tr(1.2, 0.3)}>
              ≈60% {t.back}
            </motion.span>
          </div>
          <p className="mt-3 text-[15px] font-medium">{t.items[1].name}</p>
          <p className="mt-1 text-[14px] leading-snug text-graphite">{t.items[1].plain}</p>
        </div>
        <div>
          <div className="relative flex h-24 items-center overflow-hidden border-b border-rule px-1">
            <div className="relative h-2 w-full rounded-full bg-[linear-gradient(to_right,var(--color-pulp),var(--color-rule),var(--color-pulp))]">
              <span className="absolute left-0 top-4 font-mono text-[12px] text-ash">−1</span>
              <span className="absolute left-1/2 top-4 -translate-x-1/2 font-mono text-[12px] text-ash">0</span>
              <span className="absolute right-0 top-4 font-mono text-[12px] text-ash">+1</span>
              <span className="absolute inset-y-[-6px] left-[80%] border-l border-dashed border-amber-ink" />
              <span className="absolute inset-y-[-6px] left-[20%] border-l border-dashed border-amber-ink" />
              <motion.span className="absolute inset-0" initial={{ x: "50%" }} animate={{ x: seen ? "91%" : "50%" }} transition={tr(0.3, 0.8)}>
                <span className="absolute left-0 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber ring-4 ring-paper" />
              </motion.span>
            </div>
          </div>
          <p className="mt-3 text-[15px] font-medium">{t.items[2].name}</p>
          <p className="mt-1 text-[14px] leading-snug text-graphite">{t.items[2].plain}</p>
        </div>
      </div>
    </Figure>
  );
}

/* ---------------------------------------------------------------- Score builder */

const SC_T = {
  en: {
    title: "Build a risk score",
    model: "How unusual the Isolation Forest finds the minute",
    rules: "Rules that fired",
    ruleNames: ["Volume above 2.5", "More than half reversed", "One-sided beyond 0.6"],
    formula: "Score = 100 × (0.6 × model + 0.4 × share of rules)",
    levels: { none: "No alert", elevated: "Elevated", high: "High" },
    caption: "The paper's formula. Elevated starts at 50 and High at 70. The code calls it the HFT risk score, but it measures unusual trading, not manipulation.",
  },
  fr: {
    title: "Construire un score de risque",
    model: "À quel point l'Isolation Forest trouve la minute inhabituelle",
    rules: "Règles déclenchées",
    ruleNames: ["Volume au-dessus de 2,5", "Plus de la moitié rendue", "Un seul côté au-delà de 0,6"],
    formula: "Score = 100 × (0,6 × modèle + 0,4 × part des règles)",
    levels: { none: "Pas d'alerte", elevated: "Élevé", high: "Fort" },
    caption: "La formule de l'article. Élevé commence à 50 et Fort à 70. Le code l'appelle le HFT risk score, mais il mesure un trading inhabituel, pas une manipulation.",
  },
};

export function ScoreFigure({ locale, n }: { locale: Locale; n: string }) {
  const t = SC_T[locale];
  const [model, setModel] = useState(70);
  const [rules, setRules] = useState([true, false, true]);
  const fired = rules.filter(Boolean).length;
  const score = Math.round(100 * (0.6 * (model / 100) + 0.4 * (fired / 3)));
  const level = score >= 70 ? "high" : score >= 50 ? "elevated" : "none";
  const fmt = (v: number) => new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US").format(v);
  return (
    <Figure label={n} title={t.title} caption={t.caption}>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="grid gap-5">
          <label className="grid gap-2">
            <span className="flex items-baseline justify-between gap-3 text-[14px]">
              <span>{t.model}</span>
              <span className="font-mono tabular">{fmt(model)}%</span>
            </span>
            <input type="range" min={0} max={100} step={1} value={model} onChange={(e) => setModel(Number(e.target.value))}
              className="w-full accent-[var(--color-ink)]" />
          </label>
          <fieldset className="grid">
            <legend className="mb-2 text-[14px]">{t.rules}</legend>
            {t.ruleNames.map((name, i) => (
              <label key={name} className="flex min-h-10 cursor-pointer items-center gap-3 border-t border-rule text-[14px] last:border-b">
                <input type="checkbox" checked={rules[i]} onChange={() => setRules((r) => r.map((v, k) => (k === i ? !v : v)))} className="h-4 w-4 accent-[var(--color-ink)]" />
                {name}
              </label>
            ))}
          </fieldset>
        </div>
        <div className="grid content-start gap-4">
          <p className="font-mono text-[13px] text-graphite">{t.formula}</p>
          <p aria-live="polite" className="flex items-baseline gap-3">
            <span className="font-display text-[64px] leading-none tracking-[-0.02em] tabular">{score}</span>
            <span className={cn("rounded-md px-2 py-1 text-[14px]", level === "high" ? "bg-urgent text-white" : level === "elevated" ? "bg-amber-ink text-white" : "bg-pulp text-graphite")}>
              {t.levels[level]}
            </span>
          </p>
          <div className="relative h-3 rounded-full bg-pulp">
            <div className="absolute inset-y-0 left-0 w-full origin-left rounded-full bg-ink transition-transform duration-300 ease-[var(--ease-premium)]" style={{ transform: `scaleX(${score / 100})` }} />
            <span className="absolute -top-1 bottom-[-4px] left-1/2 border-l-2 border-amber" />
            <span className="absolute -top-1 bottom-[-4px] left-[70%] border-l-2 border-urgent" />
          </div>
          <div className="relative h-5 font-mono text-[12px] text-ash">
            <span className="absolute left-1/2 -translate-x-1/2">50</span>
            <span className="absolute left-[70%] -translate-x-1/2">70</span>
          </div>
        </div>
      </div>
    </Figure>
  );
}
