"use client";
// Section 6 result figures: the alert dial, the controls, market-wide clustering, planted events, base rate.
import { motion } from "motion/react";
import { useState } from "react";
import type { Locale } from "@/content/i18n";
import { EASE, useReveal } from "@/lib/hooks";
import { cn, formatNumber } from "@/lib/utils";
import { Figure } from "./Figure";

const nf = (locale: Locale, v: number, d = 1) => formatNumber(v, locale === "fr" ? "fr-FR" : "en-US", d);

function Segmented<T extends string | number>({ label, options, value, onChange, render }: {
  label: string; options: readonly T[]; value: T; onChange: (v: T) => void; render: (v: T) => string;
}) {
  const index = options.indexOf(value);
  return (
    <div className="grid gap-2">
      <span className="text-[14px] text-graphite">{label}</span>
      <div role="radiogroup" aria-label={label} className="relative grid h-10 rounded-lg bg-pulp p-1" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
        onKeyDown={(e) => {
          if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
          e.preventDefault();
          const next = options[(index + (e.key === "ArrowRight" ? 1 : options.length - 1)) % options.length];
          onChange(next);
          (e.currentTarget.querySelectorAll("button")[options.indexOf(next)] as HTMLButtonElement | undefined)?.focus();
        }}>
        <span aria-hidden className="absolute bottom-1 left-1 top-1 rounded-[4px] bg-paper shadow-[0_1px_2px_rgba(23,24,28,.12),inset_0_-1px_0_rgba(23,24,28,.06)] transition-transform duration-300 ease-[var(--ease-premium)] motion-reduce:transition-none"
          style={{ width: `calc((100% - 8px) / ${options.length})`, transform: `translateX(${index * 100}%)` }} />
        {options.map((o) => (
          <button key={String(o)} type="button" role="radio" aria-checked={o === value} tabIndex={o === value ? 0 : -1} onClick={() => onChange(o)}
            className={cn("relative z-10 rounded-[4px] font-mono text-[13px] transition-colors duration-200", o === value ? "font-medium text-ink" : "text-graphite hover:text-ink")}>
            {render(o)}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Alert dial */

const DIAL: Record<number, Record<number, number>> = {
  40: { 90: 10.77, 95: 6.62, 99: 1.76 },
  50: { 90: 8.2, 95: 4.92, 99: 1.35 },
  60: { 90: 5.64, 95: 3.44, 99: 1.12 },
};
const GATES = [90, 95, 99] as const;
const CUTS = [40, 50, 60] as const;

const D_T = {
  en: {
    title: "The alert count is a dial",
    gate: "Model gate (percentile)",
    cut: "Alert cut-off (score)",
    unit: "alert episodes per stock per day",
    paper: "the paper's setting",
    caption: "Real data, 20 stocks, 8 test sessions. Same market, same days: only the settings change.",
  },
  fr: {
    title: "Le nombre d'alertes est un bouton de réglage",
    gate: "Seuil du modèle (centile)",
    cut: "Seuil d'alerte (score)",
    unit: "épisodes d'alerte par action et par jour",
    paper: "le réglage de l'article",
    caption: "Données réelles, 20 actions, 8 séances de test. Même marché, mêmes jours : seuls les réglages changent.",
  },
};

export function DialFigure({ locale, n }: { locale: Locale; n: string }) {
  const t = D_T[locale];
  const [gate, setGate] = useState<(typeof GATES)[number]>(95);
  const [cut, setCut] = useState<(typeof CUTS)[number]>(50);
  const value = DIAL[cut][gate];
  const isPaper = gate === 95 && cut === 50;
  return (
    <Figure label={n} title={t.title} caption={t.caption}>
      <div className="grid gap-8 md:grid-cols-[1fr_1.1fr] md:items-center">
        <div className="grid gap-5">
          <Segmented label={t.gate} options={GATES} value={gate} onChange={setGate} render={(v) => `${v}e`.replace("e", locale === "fr" ? "e" : "th")} />
          <Segmented label={t.cut} options={CUTS} value={cut} onChange={setCut} render={(v) => String(v)} />
        </div>
        <div>
          <p aria-live="polite" className="font-display text-[clamp(64px,9vw,112px)] leading-none tracking-[-0.03em] tabular">{nf(locale, value)}</p>
          <p className="mt-2 text-[15px] text-graphite">{t.unit}{isPaper && <span className="text-amber-ink"> · {t.paper}</span>}</p>
          <div className="mt-5 grid grid-cols-3 gap-2" aria-hidden>
            {CUTS.map((c) => GATES.map((g) => {
              const v = DIAL[c][g];
              const on = c === cut && g === gate;
              return (
                <span key={`${c}-${g}`} className={cn("grid h-9 place-items-center rounded-md font-mono text-[12px] transition-colors duration-200", on ? "bg-ink text-newsprint" : "text-graphite")}
                  style={on ? undefined : { backgroundColor: `color-mix(in srgb, var(--color-amber) ${Math.round((v / 10.77) * 40)}%, var(--color-newsprint))` }}>
                  {nf(locale, v)}
                </span>
              );
            }))}
          </div>
        </div>
      </div>
    </Figure>
  );
}

/* ---------------------------------------------------------------- Controls */

const C_T = {
  en: {
    title: "Real markets versus noise",
    unit: "alerts per stock per day",
    rows: ["Real data", "Shuffled within each session", "Shuffled in 10-minute blocks", "20 calmer large caps, same dates"],
    rev: "with a reversal",
    caption: "If the detector were reacting to something only real markets contain, shuffling would change the rate. It does not. Shuffling also removes normal volume clustering, so this is a rough check, not proof that there is no manipulation.",
  },
  fr: {
    title: "Marchés réels contre bruit",
    unit: "alertes par action et par jour",
    rows: ["Données réelles", "Mélangées dans chaque séance", "Mélangées par blocs de 10 minutes", "20 grandes valeurs plus calmes, mêmes dates"],
    rev: "avec un retour",
    caption: "Si le détecteur réagissait à quelque chose que seuls les vrais marchés contiennent, mélanger changerait le taux. Ce n'est pas le cas. Le mélange efface aussi le regroupement normal du volume : c'est une vérification grossière, pas la preuve qu'il n'y a pas de manipulation.",
  },
};

export function ControlsFigure({ locale, n }: { locale: Locale; n: string }) {
  const t = C_T[locale];
  const { ref, seen, reduce } = useReveal<HTMLDivElement>();
  const data = [
    { v: 4.9, rev: 15 },
    { v: 4.9, rev: 16 },
    { v: 4.8, rev: null },
    { v: 5.0, rev: 12 },
  ];
  return (
    <Figure label={n} title={t.title} caption={t.caption}>
      <div ref={ref} className="grid gap-4">
        {data.map((d, i) => (
          <div key={t.rows[i]}>
            <div className="flex items-baseline justify-between gap-3 text-[14px]">
              <span className={i === 0 ? "text-ink" : "text-graphite"}>{t.rows[i]}</span>
              <span className="whitespace-nowrap font-mono tabular">
                {nf(locale, d.v)}
                {d.rev !== null && <span className="text-ash"> · {d.rev}{locale === "fr" ? " %" : "%"} {t.rev}</span>}
              </span>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-pulp">
              <motion.div className={cn("h-full origin-left rounded-full", i === 0 ? "bg-amber" : "bg-graphite")}
                initial={{ scaleX: 0 }} animate={{ scaleX: seen ? d.v / 5.2 : 0 }} transition={reduce ? { duration: 0 } : { delay: i * 0.12, duration: 0.8, ease: EASE }} />
            </div>
          </div>
        ))}
        <p className="text-[13px] text-ash">{t.unit}</p>
      </div>
    </Figure>
  );
}

/* ---------------------------------------------------------------- Clustering */

const TICKERS = ["TSLA", "NVDA", "AAPL", "AMD", "META", "AMZN", "SPY", "QQQ", "TQQQ", "SQQQ", "SOXL", "GME", "AMC", "PLTR", "SOFI", "COIN", "MARA", "RIVN", "HOOD", "NIO"];
const AT_1217 = new Set(["AMZN", "HOOD", "QQQ", "SPY", "SQQQ", "AAPL", "SOFI", "AMD", "TQQQ"]);

const K_T = {
  en: {
    title: "When many stocks alert at once",
    moment: "8 October, 12:17 p.m.: 9 of the 20 stocks alerted in the same minute",
    share: "Share of alert episodes with 3 or more other stocks alerting within 2 minutes",
    rows: [
      { label: "Real data", v: 28, lo: 22, hi: 33 },
      { label: "Same alerts moved to random times", v: 7, lo: 4, hi: 10 },
      { label: "Independently shuffled data", v: 15, lo: 14, hi: 16, range: true },
      { label: "Calmer comparison stocks", v: 21, lo: null, hi: null },
    ],
    caption: "The one result that clearly beats chance. It fits news or market-wide trading moving many stocks together, not one stock being pushed.",
  },
  fr: {
    title: "Quand beaucoup d'actions alertent en même temps",
    moment: "8 octobre, 12 h 17 : 9 des 20 actions ont alerté dans la même minute",
    share: "Part des épisodes où 3 autres actions ou plus alertent dans les 2 minutes",
    rows: [
      { label: "Données réelles", v: 28, lo: 22, hi: 33 },
      { label: "Mêmes alertes déplacées au hasard", v: 7, lo: 4, hi: 10 },
      { label: "Données mélangées indépendamment", v: 15, lo: 14, hi: 16, range: true },
      { label: "Actions de comparaison plus calmes", v: 21, lo: null, hi: null },
    ],
    caption: "Le seul résultat qui dépasse nettement le hasard. Il correspond à une nouvelle ou à un échange à l'échelle du marché qui fait bouger beaucoup d'actions ensemble, pas à une action poussée seule.",
  },
};

export function ClusteringFigure({ locale, n }: { locale: Locale; n: string }) {
  const t = K_T[locale];
  const { ref, seen, reduce } = useReveal<HTMLDivElement>();
  const pct = (v: number) => (locale === "fr" ? `${v} %` : `${v}%`);
  return (
    <Figure label={n} title={t.title} caption={t.caption}>
      <div ref={ref} className="grid gap-8 md:grid-cols-2 md:gap-10">
        <div>
          <p className="text-[15px]">{t.moment}</p>
          <ul className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-5">
            {TICKERS.map((tk, i) => {
              const hit = AT_1217.has(tk);
              return (
                <motion.li key={tk}
                  className={cn("grid h-10 place-items-center rounded-md border font-mono text-[12px]", hit ? "border-amber" : "border-rule text-graphite")}
                  initial={{ backgroundColor: "rgba(217,72,15,0)" }}
                  animate={{ backgroundColor: hit && seen ? "rgba(217,72,15,0.16)" : "rgba(217,72,15,0)" }}
                  transition={reduce ? { duration: 0 } : { delay: 0.3 + (hit ? 0.04 * i : 0), duration: 0.25 }}>
                  <span className={hit ? "text-amber-ink" : undefined}>{tk}</span>
                </motion.li>
              );
            })}
          </ul>
        </div>
        <div>
          <p className="text-[14px] text-graphite">{t.share}</p>
          <div className="mt-4 grid gap-4">
            {t.rows.map((r, i) => (
              <div key={r.label}>
                <div className="flex items-baseline justify-between gap-3 text-[14px]">
                  <span>{r.label}</span>
                  <span className="whitespace-nowrap font-mono tabular">{"range" in r && r.range ? `${pct(r.lo ?? 0)}–${pct(r.hi ?? 0)}` : pct(r.v)}</span>
                </div>
                <div className="relative mt-2 h-3 rounded-full bg-pulp">
                  <motion.div className={cn("absolute inset-y-0 left-0 w-full origin-left rounded-full", i === 0 ? "bg-amber" : "bg-graphite")}
                    initial={{ scaleX: 0 }} animate={{ scaleX: seen ? r.v / 40 : 0 }} transition={reduce ? { duration: 0 } : { delay: 0.6 + i * 0.12, duration: 0.8, ease: EASE }} />
                  {r.lo !== null && r.hi !== null && (
                    <span className="absolute -top-1 bottom-[-4px] border-x-2 border-ink/50" style={{ left: `${(r.lo / 40) * 100}%`, width: `${((r.hi - r.lo) / 40) * 100}%` }} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Figure>
  );
}

/* ---------------------------------------------------------------- Planted events */

const P_T = {
  en: {
    title: "Finding 800 planted push-and-reverse events",
    rows: ["Combined score", "Rules alone", "Isolation Forest alone"],
    found: "found",
    caption: "The events were built to look like the pattern the rules describe, so these are best cases. Combining the two finds more events, at the cost of more alerts.",
  },
  fr: {
    title: "Retrouver 800 événements de poussée et de retour implantés",
    rows: ["Score combiné", "Règles seules", "Isolation Forest seul"],
    found: "retrouvés",
    caption: "Les événements ont été construits pour ressembler au schéma que décrivent les règles : ce sont des cas favorables. Combiner les deux en retrouve plus, au prix de plus d'alertes.",
  },
};

export function PlantedFigure({ locale, n }: { locale: Locale; n: string }) {
  const t = P_T[locale];
  const { ref, seen, reduce } = useReveal<HTMLDivElement>();
  const values = [78, 69, 62];
  return (
    <Figure label={n} title={t.title} caption={t.caption}>
      <div ref={ref} className="grid gap-4">
        {values.map((v, i) => (
          <div key={t.rows[i]} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5">
            <span className="text-[14px]">{t.rows[i]}</span>
            <span className="font-display text-[28px] leading-none tabular">{locale === "fr" ? `${v} %` : `${v}%`}</span>
            <div className="col-span-2 flex h-3 gap-[2px]" aria-hidden>
              {Array.from({ length: 50 }, (_, k) => (
                <motion.span key={k} className={cn("flex-1 rounded-[1px]", k < v / 2 ? (i === 0 ? "bg-amber" : "bg-graphite") : "bg-pulp")}
                  initial={{ opacity: 0.25 }} animate={{ opacity: seen ? 1 : 0.25 }} transition={reduce ? { duration: 0 } : { delay: i * 0.15 + k * 0.012, duration: 0.2 }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Figure>
  );
}

/* ---------------------------------------------------------------- Base rate */

const B_T = {
  en: {
    title: "1,000 alerts, if manipulation is rare",
    toggle: "Suppose real cases are",
    opts: ["1 alert in 100", "1 alert in 10"],
    real: "real",
    falseLabel: "false alarms",
    caption: "An assumption to show the arithmetic, not a measurement. Acting on an alert also costs money: one needless round trip costs 0.07 to 0.46 percent, so a flag is a reason to wait and look, not to chase the move.",
  },
  fr: {
    title: "1 000 alertes, si la manipulation est rare",
    toggle: "Supposons que les vrais cas soient",
    opts: ["1 alerte sur 100", "1 alerte sur 10"],
    real: "réelles",
    falseLabel: "fausses alertes",
    caption: "Une hypothèse pour montrer le calcul, pas une mesure. Agir sur une alerte coûte aussi de l'argent : un aller-retour inutile coûte de 0,07 à 0,46 % ; une alerte est une raison d'attendre et de regarder, pas de suivre le mouvement.",
  },
};

export function BaseRateFigure({ locale, n }: { locale: Locale; n: string }) {
  const t = B_T[locale];
  const [mode, setMode] = useState<0 | 1>(0);
  const real = mode === 0 ? 10 : 100;
  const { ref, seen } = useReveal<HTMLDivElement>(0.3);
  // Spread the real alerts through the grid deterministically.
  const isReal = (i: number) => (i * 37) % 1000 < real;
  return (
    <Figure label={n} title={t.title} caption={t.caption}>
      <div ref={ref} className="grid gap-6 lg:grid-cols-[1fr_260px] lg:items-start">
        <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(40, minmax(0, 1fr))" }} aria-hidden>
          {Array.from({ length: 1000 }, (_, i) => (
            <span key={i} className={cn("aspect-square rounded-full transition-colors duration-500", seen && isReal(i) ? "bg-amber" : "bg-rule")} />
          ))}
        </div>
        <div className="grid gap-4">
          <Segmented label={t.toggle} options={[0, 1] as const} value={mode} onChange={setMode} render={(v) => t.opts[v]} />
          <p aria-live="polite">
            <span className="block font-display text-[56px] leading-none tracking-[-0.02em] tabular">{nf(locale, 1000 - real, 0)}</span>
            <span className="text-[15px] text-graphite">{t.falseLabel}</span>
          </p>
          <p className="flex items-center gap-2 text-[15px]">
            <span aria-hidden className="h-3 w-3 rounded-full bg-amber" />
            {nf(locale, real, 0)} {t.real}
          </p>
        </div>
      </div>
    </Figure>
  );
}
