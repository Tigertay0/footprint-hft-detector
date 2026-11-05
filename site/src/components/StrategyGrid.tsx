"use client";
// Section 3 specimen grid: one card per strategy, each with a small looping drawing that plays on hover,
// focus, or when the card is centred on a touch screen.
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/content/i18n";
import { cn } from "@/lib/utils";

type Kind = "ignition" | "spoof" | "stuff" | "close" | "expiry";

const CARDS: { id: string; kind: Kind; visible: boolean; en: { name: string; line: string; evidence: string }; fr: { name: string; line: string; evidence: string } }[] = [
  { id: "s3-1", kind: "ignition", visible: true,
    en: { name: "Momentum ignition", line: "Push the price, let others chase it, then sell into them", evidence: "Pattern measured in data" },
    fr: { name: "Allumage de momentum", line: "Pousser le prix, laisser les autres suivre, puis leur revendre", evidence: "Schéma mesuré dans les données" } },
  { id: "s3-2", kind: "spoof", visible: false,
    en: { name: "Spoofing and layering", line: "Show big orders you never mean to fill, trade on the other side, cancel", evidence: "Conviction, 2015" },
    fr: { name: "Spoofing et layering", line: "Afficher de gros ordres qu'on n'exécutera jamais, négocier de l'autre côté, annuler", evidence: "Condamnation, 2015" } },
  { id: "s3-3", kind: "stuff", visible: false,
    en: { name: "Quote stuffing", line: "Flood the feed with orders and cancels so everyone else sees it late", evidence: "Pattern measured in data" },
    fr: { name: "Bourrage de cotations", line: "Inonder le flux d'ordres et d'annulations pour que les autres voient tout en retard", evidence: "Schéma mesuré dans les données" } },
  { id: "s3-4", kind: "close", visible: false,
    en: { name: "Marking the close", line: "Trade hard in the last seconds to move the closing price", evidence: "Settled, 2014" },
    fr: { name: "Manipulation de la clôture", line: "Négocier fort dans les dernières secondes pour déplacer le cours de clôture", evidence: "Règlement, 2014" } },
  { id: "s3-5", kind: "expiry", visible: true,
    en: { name: "Expiry-day index manipulation", line: "Lift an index in the morning, sink it on expiry afternoon, profit in options", evidence: "Pending allegation, 2025" },
    fr: { name: "Manipulation d'indice le jour d'expiration", line: "Monter un indice le matin, le faire baisser l'après-midi de l'expiration, gagner sur les options", evidence: "Allégation en cours, 2025" } },
];

const VERDICT = {
  en: { yes: "Visible in one-minute data, in principle", no: "Too fast or hidden for one-minute data", read: "Read" },
  fr: { yes: "Visible dans les données minute, en principe", no: "Trop rapide ou invisible dans les données minute", read: "Lire" },
};

function Drawing({ kind }: { kind: Kind }) {
  switch (kind) {
    case "ignition":
      return (
        <svg viewBox="0 0 200 90" className="h-full w-full" aria-hidden>
          <path d="M0,62 L50,60 L80,58" fill="none" stroke="var(--color-ink)" strokeWidth="2" />
          <path className="loop [animation:draw_2.4s_ease-in-out_infinite] [stroke-dasharray:100]" d="M80,58 L110,18 L150,44 L200,46" fill="none" stroke="var(--color-amber)" strokeWidth="2.5" pathLength={100} />
          {[60, 70, 80, 90, 100, 110].map((x, i) => (
            <rect key={x} x={x} y={90 - (i > 1 ? 26 : 10)} width="6" height={i > 1 ? 26 : 10} fill={i > 1 ? "var(--color-amber)" : "var(--color-rule)"} opacity=".7" />
          ))}
        </svg>
      );
    case "spoof":
      return (
        <svg viewBox="0 0 200 90" className="h-full w-full" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} className="loop [animation:blink_2.4s_ease-in-out_infinite]" style={{ animationDelay: `${i * 0.08}s` }} x={110} y={8 + i * 15} width={70 - i * 8} height="11" rx="2" fill="var(--color-amber)" opacity=".75" />
          ))}
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={`b${i}`} x={90 - (20 + i * 6)} y={8 + i * 15} width={20 + i * 6} height="11" rx="2" fill="var(--color-rule)" />
          ))}
          <line x1="100" x2="100" y1="2" y2="88" stroke="var(--color-graphite)" strokeDasharray="2 3" />
        </svg>
      );
    case "stuff":
      return (
        <svg viewBox="0 0 200 90" className="h-full w-full" aria-hidden>
          {Array.from({ length: 18 }, (_, i) => (
            <rect key={i} className="loop [animation:flood_1.2s_linear_infinite]" style={{ animationDelay: `${(i % 6) * 0.2}s` }} x={(i * 23) % 190} y={6 + (i % 6) * 13} width="10" height="6" rx="1" fill={i % 3 === 0 ? "var(--color-amber)" : "var(--color-graphite)"} opacity=".6" />
          ))}
        </svg>
      );
    case "close":
      return (
        <svg viewBox="0 0 200 90" className="h-full w-full" aria-hidden>
          <path d="M0,50 L120,48 L160,50" fill="none" stroke="var(--color-ink)" strokeWidth="2" />
          <path className="loop [animation:draw_2.4s_ease-in-out_infinite] [stroke-dasharray:100]" d="M160,50 L200,22" fill="none" stroke="var(--color-amber)" strokeWidth="2.5" pathLength={100} />
          <line x1="160" x2="160" y1="8" y2="84" stroke="var(--color-rule)" />
          <text x="196" y="84" textAnchor="end" className="fill-graphite font-serif text-[13px]">15:59:5x</text>
        </svg>
      );
    case "expiry":
      return (
        <svg viewBox="0 0 200 90" className="h-full w-full" aria-hidden>
          <path className="loop [animation:draw_2.8s_ease-in-out_infinite] [stroke-dasharray:100]" d="M0,70 C30,66 60,30 100,24 C140,22 160,60 200,76" fill="none" stroke="var(--color-amber)" strokeWidth="2.5" pathLength={100} />
          <line x1="100" x2="100" y1="6" y2="86" stroke="var(--color-rule)" strokeDasharray="2 3" />
        </svg>
      );
  }
}

export function StrategyGrid({ locale }: { locale: Locale }) {
  const v = VERDICT[locale];
  const [active, setActive] = useState<string | null>(null);
  const refs = useRef<Map<string, HTMLElement>>(new Map());

  useEffect(() => {
    if (!window.matchMedia("(hover: none)").matches) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive((e.target as HTMLElement).dataset.id ?? null);
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    refs.current.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <ul className="grid gap-4 md:grid-cols-6">
      {CARDS.map((c, i) => {
        const t = c[locale];
        return (
          <li
            key={c.id}
            data-id={c.id}
            data-active={active === c.id}
            ref={(el) => { if (el) refs.current.set(c.id, el); }}
            className={cn(
              "strategy group flex flex-col rounded-xl border border-rule bg-paper p-5 shadow-[var(--shadow-card)] transition-[transform,box-shadow] duration-300 ease-[var(--ease-premium)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]",
              i < 3 ? "md:col-span-2" : "md:col-span-3",
            )}
          >
            <div className="h-24 rounded-lg bg-newsprint p-2">
              <Drawing kind={c.kind} />
            </div>
            <p className="mt-4 font-display text-[24px] leading-tight tracking-[-0.01em]">{t.name}</p>
            <p className="mt-2 text-[15px] leading-snug text-graphite">{t.line}</p>
            <div className="mt-auto flex flex-col items-start gap-2 pt-5">
              <p className="text-[14px] text-graphite">{t.evidence}</p>
              <span
                className={cn(
                  "inline-flex min-h-7 items-center rounded-md border px-2 text-[13px] leading-snug",
                  c.visible
                    ? "border-transparent bg-[color-mix(in_srgb,var(--color-held)_14%,transparent)] text-held"
                    : "border-rule text-graphite",
                )}
              >
                {c.visible ? v.yes : v.no}
              </span>
              <a href={`#${c.id}`} className="link text-[14px] text-ink">
                {v.read} {c.id.replace("s", "").replace("-", ".")}
              </a>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
