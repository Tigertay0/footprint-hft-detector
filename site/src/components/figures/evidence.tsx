"use client";
// Section 4-5 figures: who pays, and how long enforcement takes.
import { motion, useMotionValue, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";
import { useRef } from "react";
import type { Locale } from "@/content/i18n";
import { EASE, useReveal } from "@/lib/hooks";
import { Figure } from "./Figure";

const T = {
  whoPays: {
    en: {
      title: "Who pays aggressive HFTs, per contract",
      small: "Small traders",
      large: "Large fundamental traders",
      more: "Small traders paid about 82 percent more per contract.",
      costTitle: "Cost of one trade, as a share of its value",
      latency: "Lost to latency arbitrage (0.5 basis points)",
      round: "One needless round trip at a retail broker",
      caption: "E-mini S&P 500 futures, August 2010 (Baron, Brogaard and Kirilenko); London races (Aquilina, Budish and O'Neill); round trips at five U.S. brokers (Schwarz et al.).",
    },
    fr: {
      title: "Ce que paient les traders aux HFT agressifs, par contrat",
      small: "Petits traders",
      large: "Grands traders fondamentaux",
      more: "Les petits traders ont payé environ 82 % de plus par contrat.",
      costTitle: "Coût d'une transaction, en part de sa valeur",
      latency: "Perdu à l'arbitrage de latence (0,5 point de base)",
      round: "Un aller-retour inutile chez un courtier de détail",
      caption: "Contrats à terme E-mini S&P 500, août 2010 (Baron, Brogaard et Kirilenko) ; courses à Londres (Aquilina, Budish et O'Neill) ; allers-retours chez cinq courtiers américains (Schwarz et al.).",
    },
  },
  timeline: {
    en: {
      title: "From the trading to the ruling",
      legendTrade: "Trading",
      legendWait: "Waiting",
      legendAct: "Enforcement",
      rows: [
        { who: "Athena Capital (marking the close)", from: 2009.4, to: 2009.95, act: 2014.8, note: "charged 2014, settled" },
        { who: "Michael Coscia (spoofing)", from: 2011.6, to: 2011.8, act: 2015.85, note: "convicted 2015" },
        { who: "Jane Street, per SEBI (expiry days)", from: 2023.0, to: 2025.2, act: 2025.5, note: "interim order 2025, no final ruling by Oct 2026", open: true },
      ],
      cat: "Consolidated Audit Trail",
      catNotes: ["Rule 613, 2012", "plan approved, 2016", "funding order struck down, 2025", "rescission requested, 2026"],
      caption: "Dates from the paper. Enforcement arrives years after the trading, and never warns the investor on the other side.",
    },
    fr: {
      title: "De la transaction à la décision",
      legendTrade: "Transactions",
      legendWait: "Attente",
      legendAct: "Sanction",
      rows: [
        { who: "Athena Capital (cours de clôture)", from: 2009.4, to: 2009.95, act: 2014.8, note: "poursuivie en 2014, règlement" },
        { who: "Michael Coscia (spoofing)", from: 2011.6, to: 2011.8, act: 2015.85, note: "condamné en 2015" },
        { who: "Jane Street, selon la SEBI (jours d'expiration)", from: 2023.0, to: 2025.2, act: 2025.5, note: "ordonnance provisoire 2025, aucune décision finale en oct. 2026", open: true },
      ],
      cat: "Consolidated Audit Trail",
      catNotes: ["Règle 613, 2012", "plan approuvé, 2016", "financement annulé, 2025", "abrogation demandée, 2026"],
      caption: "Dates tirées de l'article. La sanction arrive des années après les transactions, et ne prévient jamais l'investisseur d'en face.",
    },
  },
};

export function WhoPaysFigure({ locale, n }: { locale: Locale; n: string }) {
  const t = T.whoPays[locale];
  const { ref, seen, reduce } = useReveal<HTMLDivElement>();
  const tr = (d: number) => (reduce ? { duration: 0 } : { delay: d, duration: 0.8, ease: EASE });
  const money = (v: number) => (locale === "fr" ? `${v.toFixed(2).replace(".", ",")} $` : `$${v.toFixed(2)}`);
  const bars = [
    { label: t.small, v: 3.49, color: "bg-amber" },
    { label: t.large, v: 1.92, color: "bg-graphite" },
  ];
  const pct = (v: string) => (locale === "fr" ? `${v.replace(".", ",")} %` : `${v}%`);
  return (
    <Figure label={n} title={t.title} caption={t.caption}>
      <div ref={ref} className="grid gap-8 md:grid-cols-2 md:gap-10">
        <div>
          <div className="grid gap-4">
            {bars.map((b, i) => (
              <div key={b.label}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[15px]">{b.label}</span>
                  <span className="font-display text-[28px] leading-none tabular">{money(b.v)}</span>
                </div>
                <div className="mt-2 h-3 overflow-hidden rounded-full bg-pulp">
                  <motion.div
                    className={`h-full origin-left rounded-full ${b.color}`}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: seen ? b.v / 3.49 : 0 }}
                    transition={tr(0.15 * i)}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[15px] text-amber-ink">{t.more}</p>
        </div>
        <div>
          <p className="text-[15px] text-graphite">{t.costTitle}</p>
          <div className="mt-3 grid gap-4">
            <div>
              <div className="flex items-baseline justify-between gap-3 text-[14px]">
                <span>{t.latency}</span>
                <span className="font-mono tabular">{pct("0.005")}</span>
              </div>
              <div className="relative mt-2 h-3 rounded-full bg-pulp">
                <motion.div className="absolute inset-y-0 left-0 w-full origin-left rounded-full bg-graphite" initial={{ scaleX: 0 }} animate={{ scaleX: seen ? 0.005 / 0.46 : 0 }} transition={tr(0.3)} />
              </div>
            </div>
            <div>
              <div className="flex items-baseline justify-between gap-3 text-[14px]">
                <span>{t.round}</span>
                <span className="font-mono tabular">{pct("0.07")}–{pct("0.46")}</span>
              </div>
              <div className="relative mt-2 h-3 rounded-full bg-pulp">
                <motion.div className="absolute inset-y-0 left-0 w-full origin-left rounded-full bg-amber/35" initial={{ scaleX: 0 }} animate={{ scaleX: seen ? 1 : 0 }} transition={tr(0.45)} />
                <motion.div className="absolute inset-y-0 left-0 w-full origin-left rounded-full bg-amber" initial={{ scaleX: 0 }} animate={{ scaleX: seen ? 0.07 / 0.46 : 0 }} transition={tr(0.45)} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Figure>
  );
}

const START = 2008;
const END = 2028;
const pos = (year: number) => `${((year - START) / (END - START)) * 100}%`;

function Row({ progress, index, total, row }: { progress: MotionValue<number>; index: number; total: number; row: { who: string; from: number; to: number; act: number; note: string; open?: boolean } }) {
  const local = useTransform(progress, [index / total, (index + 0.9) / total], [0, 1], { clamp: true });
  const opacity = useTransform(local, [0.85, 1], [0, 1]);
  const width = ((row.act - row.from) / (END - START)) * 100;
  return (
    <li className="grid gap-2">
      <span className="text-[14px] leading-snug">{row.who}</span>
      <div className="relative h-5">
        <div className="absolute inset-y-[9px] left-0 right-0 bg-rule/60" />
        <motion.div
          className="absolute inset-y-[7px] origin-left"
          style={{ left: pos(row.from), width: `${width}%`, scaleX: local }}
        >
          <div className="absolute inset-y-0 left-0 rounded-full bg-ink" style={{ width: `${((row.to - row.from) / (row.act - row.from)) * 100}%` }} />
          <div className="absolute inset-y-[2px] right-0 border-t-2 border-dashed border-amber" style={{ left: `${((row.to - row.from) / (row.act - row.from)) * 100}%` }} />
        </motion.div>
        <motion.span
          className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ${row.open ? "border-2 border-amber bg-paper" : "bg-amber"}`}
          style={{ left: pos(row.act), opacity }}
        />
      </div>
      <motion.span className="text-[13px] text-graphite" style={{ opacity }}>{row.note}</motion.span>
    </li>
  );
}

export function TimelineFigure({ locale, n }: { locale: Locale; n: string }) {
  const t = T.timeline[locale];
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 85%", "end 55%"] });
  const full = useMotionValue(1);
  const progress = useReducedMotion() ? full : scrollYProgress;
  const ticks = [2008, 2012, 2016, 2020, 2024, 2028];
  const cat = [2012, 2016, 2025.5, 2026.6];
  return (
    <Figure label={n} title={t.title} caption={t.caption}>
      <div ref={ref}>
        <div className="mb-4 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-graphite">
          <span className="flex items-center gap-2"><span aria-hidden className="h-[6px] w-5 rounded-full bg-ink" />{t.legendTrade}</span>
          <span className="flex items-center gap-2"><span aria-hidden className="w-5 border-t-2 border-dashed border-amber" />{t.legendWait}</span>
          <span className="flex items-center gap-2"><span aria-hidden className="h-3 w-3 rounded-full bg-amber" />{t.legendAct}</span>
        </div>
        <ol className="grid gap-5">
          {t.rows.map((row, i) => (
            <Row key={row.who} progress={progress} index={i} total={t.rows.length + 1} row={row} />
          ))}
          <li className="grid gap-2">
            <span className="text-[14px]">{t.cat}</span>
            <div className="relative h-5">
              <div className="absolute inset-y-[9px] left-0 right-0 bg-rule/60" />
              {cat.map((y) => (
                <span key={y} className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-graphite bg-paper" style={{ left: pos(y) }} />
              ))}
            </div>
            <span className="text-[13px] leading-snug text-graphite">{t.catNotes.join(" · ")}</span>
          </li>
        </ol>
        <div className="relative mt-4 h-5 border-t border-rule font-mono text-[12px] text-ash">
          {ticks.map((y) => (
            <span key={y} className="absolute top-1 -translate-x-1/2 first:translate-x-0 last:-translate-x-full" style={{ left: pos(y) }}>{y}</span>
          ))}
        </div>
      </div>
    </Figure>
  );
}
