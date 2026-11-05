import { UI, type Locale } from "@/content/i18n";
import { ZENODO } from "@/lib/site";
import { HeroFigure } from "./HeroFigure";
import { HeroGrid } from "./ui/HeroGrid";
import { CountUp } from "./ui/CountUp";
import type { FeedItem } from "./ui/NotificationCard";

// Round's composition: a centred serif headline and actions, with the drawing rising out of the hero below them.
export function Hero({ locale, card }: { locale: Locale; card: FeedItem }) {
  const ui = UI[locale];
  return (
    <section id="top" className="relative overflow-hidden pt-16">
      <HeroGrid />
      <div className="relative mx-auto max-w-[1200px] px-5 pt-12 md:px-8 md:pt-12">
        <div className="mx-auto max-w-[920px] md:text-center">
          <p className="text-[15px] text-graphite">{ui.eyebrow}</p>
          <h1 className="display mt-6 text-[clamp(40px,5.2vw,76px)] text-balance">
            {ui.headlineLead}
            <em className={`italic text-amber-ink ${ui.headlineEm.includes("-") ? "whitespace-nowrap" : ""}`}>{ui.headlineEm}</em>
            {ui.headlineTail}
          </h1>
          <p className="mx-auto mt-6 max-w-[58ch] text-[18px] leading-[1.55] text-graphite md:text-[20px]">{ui.deck}</p>
          <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4 md:justify-center">
            <a href="#abstract" className="btn-primary text-[17px]">
              {ui.startReading}
              <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 3v10M4 9l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </a>
            <a href="#results" className="arrow-link link inline-flex items-center gap-2 text-[17px] text-ink">
              {ui.jumpToResults}
              <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4l8 8M12 6v6H6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </a>
          </div>
          <p className="mt-6 text-[14px] text-graphite">
            <a href={ZENODO.record} target="_blank" rel="noopener noreferrer" className="link">
              {ui.zenodo.preprint}
            </a>
            <span aria-hidden> · </span>
            <span className="font-mono text-[13px]">{ui.zenodo.doi} {ZENODO.doi}</span>
          </p>
        </div>
        <div className="mt-10 md:mt-6">
          <HeroFigure label={ui.heroChartLabel} tag={ui.heroTag} card={card} appLabel={ui.heroCard.app} timeLabel={ui.heroCard.now} />
        </div>
      </div>
      <div className="relative mx-auto max-w-[1096px] px-5 pb-20 pt-12 md:px-8 md:pb-24">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4">
          {ui.stats.map((s) => (
            <div key={s.label} className="border-t border-rule pt-5">
              <dt className="sr-only">{s.label}</dt>
              <dd>
                <CountUp
                  value={s.value}
                  decimals={s.decimals}
                  suffix={s.suffix}
                  locale={ui.numberLocale}
                  className="block font-display text-[clamp(36px,4.4vw,56px)] leading-none tracking-[-0.02em]"
                />
                <span aria-hidden className="mt-3 block text-[15px] leading-snug text-graphite">
                  {s.label}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
