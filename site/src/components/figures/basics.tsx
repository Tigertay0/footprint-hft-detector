"use client";
// Section 1-2 figures. Shapes are SVG, every word is HTML so text stays 12px+ at any width.
import { motion } from "motion/react";
import type { Locale } from "@/content/i18n";
import { EASE, useReveal } from "@/lib/hooks";
import { Figure } from "./Figure";

const T = {
  expiry: {
    en: {
      title: "One expiry day, as SEBI describes it",
      morning: "Before noon: buying pushes the index up",
      after: "After 11:49: selling pushes it down",
      payoff: "Meanwhile, options positions gain if the index falls",
      caption: "Shape of the alleged pattern on SEBI's example day, 17 January 2024. An illustration, not real index data.",
    },
    fr: {
      title: "Un jour d'expiration, selon la SEBI",
      morning: "Avant midi : les achats poussent l'indice vers le haut",
      after: "Après 11 h 49 : les ventes le font baisser",
      payoff: "Pendant ce temps, les positions en options gagnent si l'indice baisse",
      caption: "Forme du schéma allégué le jour d'exemple de la SEBI, le 17 janvier 2024. Une illustration, pas des données réelles.",
    },
  },
  spread: {
    en: { title: "How a market maker earns the spread", bid: "Bid (buy order)", ask: "Offer (sell order)", buyer: "A buyer takes the offer at $100.05", seller: "A seller takes the bid at $100.00", earn: "+$0.05 per share, plus a small rebate from the exchange", caption: "The example from Section 2. The risk is a better-informed trader hitting the quote just before the price moves." },
    fr: { title: "Comment un teneur de marché gagne l'écart", bid: "Achat (bid)", ask: "Vente (offer)", buyer: "Un acheteur prend l'offre à 100,05 $", seller: "Un vendeur prend le bid à 100,00 $", earn: "+0,05 $ par action, plus une petite remise de la bourse", caption: "L'exemple de la section 2. Le risque : un trader mieux informé frappe la cotation juste avant que le prix ne bouge." },
  },
  race: {
    en: { title: "The latency race", setup: "The price changes on exchange A. Exchange B still shows the old quote.", fast: "Fast firm", slow: "Slower trader", stale: "takes the old quote", late: "arrives after it is gone", stats: ["about 1 race per minute per stock", "races were about 20% of volume", "about 0.5 basis points per trade"], caption: "FTSE 100 stocks on the London Stock Exchange, measured by Aquilina, Budish and O'Neill" },
    fr: { title: "La course à la latence", setup: "Le prix change sur la bourse A. La bourse B affiche encore l'ancienne cotation.", fast: "Société rapide", slow: "Trader plus lent", stale: "prend l'ancienne cotation", late: "arrive quand elle a disparu", stats: ["environ 1 course par minute et par action", "les courses : environ 20 % du volume", "environ 0,5 point de base par transaction"], caption: "Actions du FTSE 100 à la Bourse de Londres, mesurées par Aquilina, Budish et O'Neill" },
  },
};

export function ExpiryFigure({ locale, n }: { locale: Locale; n: string }) {
  const t = T.expiry[locale];
  const { ref, seen, reduce } = useReveal<HTMLDivElement>();
  const up = "M8,150 C60,148 80,140 110,120 S170,70 200,62 S236,58 250,60";
  const down = "M250,60 C270,64 290,90 320,118 S380,160 420,168 S462,170 472,172";
  const tr = (d: number, dur = 0.9) => (reduce ? { duration: 0 } : { delay: d, duration: dur, ease: EASE });
  return (
    <Figure label={n} title={t.title} caption={t.caption}>
      <div ref={ref}>
        <ul className="mb-3 grid gap-1 text-[14px]">
          <li className="flex items-center gap-2 text-amber-ink"><span aria-hidden className="h-[3px] w-5 rounded bg-amber" />{t.morning}</li>
          <li className="flex items-center gap-2 text-ink"><span aria-hidden className="h-[3px] w-5 rounded bg-ink" />{t.after}</li>
        </ul>
        <div className="relative">
          <svg viewBox="0 0 480 190" className="h-auto w-full" aria-hidden>
            <line x1="8" x2="472" y1="186" y2="186" stroke="var(--color-rule)" />
            <line x1="250" x2="250" y1="20" y2="186" stroke="var(--color-rule)" strokeDasharray="3 4" />
            <motion.path d={up} fill="none" stroke="var(--color-amber)" strokeWidth="3" strokeLinecap="round"
              initial={{ pathLength: 0 }} animate={{ pathLength: seen ? 1 : 0 }} transition={tr(0.1)} />
            <motion.path d={down} fill="none" stroke="var(--color-ink)" strokeWidth="3" strokeLinecap="round"
              initial={{ pathLength: 0 }} animate={{ pathLength: seen ? 1 : 0 }} transition={tr(1)} />
          </svg>
          <div className="mt-1 flex justify-between font-mono text-[12px] text-ash">
            <span>09:15</span>
            <span className="-translate-x-1/2 pl-[4%]">11:49</span>
            <span>15:30</span>
          </div>
        </div>
        <motion.p
          className="mt-4 flex items-center gap-2 border-t border-rule pt-3 text-[14px] text-graphite"
          initial={{ opacity: 0 }} animate={{ opacity: seen ? 1 : 0 }} transition={tr(1.9, 0.4)}
        >
          <span aria-hidden className="inline-block h-2 w-2 shrink-0 rounded-full bg-held" />
          {t.payoff}
        </motion.p>
      </div>
    </Figure>
  );
}

export function SpreadFigure({ locale, n }: { locale: Locale; n: string }) {
  const t = T.spread[locale];
  const { ref, seen, reduce } = useReveal<HTMLDivElement>();
  const tr = (d: number) => (reduce ? { duration: 0 } : { delay: d, duration: 0.5, ease: EASE });
  const fmt = (v: string) => (locale === "fr" ? `${v.replace(".", ",")} $` : `$${v}`);
  const show = (d: number) => ({ initial: { opacity: 0, y: 6 }, animate: { opacity: seen ? 1 : 0, y: seen ? 0 : 6 }, transition: tr(d) });
  return (
    <Figure label={n} title={t.title} caption={t.caption}>
      <div ref={ref} className="grid grid-cols-2">
        <div className="border-r border-rule pr-4">
          <p className="text-[13px] text-ash">{t.bid}</p>
          <p className="mt-1 font-display text-[28px] leading-none tabular">{fmt("100.00")}</p>
          <motion.p className="mt-3 text-[14px] leading-snug text-graphite" {...show(0.9)}>{t.seller}</motion.p>
        </div>
        <div className="pl-4">
          <p className="text-[13px] text-ash">{t.ask}</p>
          <p className="mt-1 font-display text-[28px] leading-none tabular">{fmt("100.05")}</p>
          <motion.p className="mt-3 text-[14px] leading-snug text-graphite" {...show(0.4)}>{t.buyer}</motion.p>
        </div>
        <motion.p
          className="col-span-2 mt-4 border-t border-rule pt-3 text-[15px] text-held"
          {...show(1.4)}
        >
          {t.earn}
        </motion.p>
      </div>
    </Figure>
  );
}

export function RaceFigure({ locale, n }: { locale: Locale; n: string }) {
  const t = T.race[locale];
  const { ref, seen, reduce } = useReveal<HTMLDivElement>();
  const tr = (d: number, dur: number) => (reduce ? { duration: 0 } : { delay: d, duration: dur, ease: EASE });
  const lanes = [
    { who: t.fast, what: t.stale, dur: 0.45, color: "bg-amber", text: "text-amber-ink" },
    { who: t.slow, what: t.late, dur: 1.6, color: "bg-graphite", text: "text-graphite" },
  ];
  return (
    <Figure label={n} title={t.title} caption={t.caption}>
      <div ref={ref}>
        <p className="text-[14px] text-graphite">{t.setup}</p>
        <div className="mt-4 grid gap-4">
          {lanes.map((l) => (
            <div key={l.who}>
              <div className="flex items-baseline justify-between gap-3 text-[14px]">
                <span className={l.text}>{l.who}</span>
                <motion.span className={l.text} initial={{ opacity: 0 }} animate={{ opacity: seen ? 1 : 0 }} transition={tr(0.2 + l.dur, 0.3)}>
                  {l.what}
                </motion.span>
              </div>
              <div className="mt-2 flex items-center gap-2 font-mono text-[12px] text-ash">
                <span>A</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-pulp">
                  <motion.div className={`h-full origin-left rounded-full ${l.color}`} initial={{ scaleX: 0 }} animate={{ scaleX: seen ? 1 : 0 }} transition={tr(0.2, l.dur)} />
                </div>
                <span>B</span>
              </div>
            </div>
          ))}
        </div>
        <ul className="mt-6 grid gap-x-6 gap-y-3 text-[14px] sm:grid-cols-3">
          {t.stats.map((s) => (
            <li key={s} className="border-t border-rule pt-2 leading-snug text-graphite">{s}</li>
          ))}
        </ul>
      </div>
    </Figure>
  );
}
