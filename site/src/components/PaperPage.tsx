import feedJson from "@/data/phone-feed.json";
import { BAND, BAND_INTRO, BAND_LABELS } from "@/content/band";
import { UI, type Locale } from "@/content/i18n";
import { ATTACH, MARKS, type Note } from "@/content/notes";
import { assertSameShape, getPaper, type Para, type Section } from "@/content/paper";
import { buildRefs, tokenize, type Token } from "@/content/tokenize";
import { InlineNotes, ParaRow, ROW, SectionHeading } from "./Article";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { Hero } from "./Hero";
import { Inline } from "./Inline";
import { toMinutes } from "@/lib/time";
import { ZENODO } from "@/lib/site";
import { PhoneBand } from "./PhoneBand";
import { StrategyGrid } from "./StrategyGrid";
import type { TocItem } from "./ui/SectionMenu";
import { TextReveal } from "./ui/TextReveal";
import { TocRail } from "./ui/TocRail";
import type { FeedItem } from "./ui/NotificationCard";

const FEED: FeedItem[] = (feedJson.feed as FeedItem[]).map((f, i) => ({ ...f, id: i }));
const HERO_CARD = FEED.find((f) => f.ticker === "TSLA" && f.kind === "EARLY WARNING" && f.at === "10:22") ?? FEED[0];

const BAND_IDS = new Set(BAND.filter((b) => b.kind === "para").map((b) => (b as { id: string }).id));

/** Tokens for every paragraph, with running citations and marks counted once per section. */
function tokenizeAll(sections: Section[], locale: Locale, refs: ReturnType<typeof buildRefs>) {
  const out = new Map<string, Token[]>();
  for (const s of sections) {
    const seen = new Set<string>();
    let marks = [...(MARKS[locale][s.id] ?? [])];
    const paras: Para[] = [...s.paras, ...s.subsections.flatMap((x) => x.paras)];
    for (const p of paras) {
      const tokens = tokenize(p.text, { refs, locale, seen, marks });
      const used = new Set(tokens.filter((t) => t.t === "mark").map((t) => t.v));
      marks = marks.filter((m) => !used.has(m));
      out.set(p.id, tokens);
    }
  }
  return out;
}

function figureNumbers(sections: Section[], locale: Locale) {
  const nums = new Map<string, string>();
  let k = 0;
  for (const s of sections) {
    for (const p of [...s.paras, ...s.subsections.flatMap((x) => x.paras)]) {
      for (const a of ATTACH[p.id] ?? []) {
        if (a.kind === "figure") nums.set(a.id, `${UI[locale].figure} ${++k}`);
      }
    }
  }
  return nums;
}

export function PaperPage({ locale }: { locale: Locale }) {
  const ui = UI[locale];
  const en = getPaper("en");
  const fr = getPaper("fr");
  assertSameShape(en, fr);
  const paper = locale === "en" ? en : fr;
  const refs = buildRefs(paper.works);
  const tokens = tokenizeAll(paper.sections, locale, refs);
  const figs = figureNumbers(paper.sections, locale);
  const abstractTokens = tokenize(paper.abstract, { refs, locale, seen: new Set() });

  const toc: TocItem[] = [
    { id: "abstract", label: ui.abstractLabel, level: 1 },
    ...paper.sections.flatMap((s) => [
      { id: s.id, label: `${s.num}. ${s.title}`, level: 1 as const },
      ...s.subsections.map((x) => ({ id: x.id, label: `${x.num} ${x.title}`, level: 2 as const })),
    ]),
    { id: "works-cited", label: paper.worksTitle, level: 1 },
  ];

  const row = (p: Para, tone: "light" | "night" = "light") => (
    <ParaRow key={p.id} para={p} tokens={tokens.get(p.id) ?? []} locale={locale} figureNumbers={figs} tone={tone} />
  );

  const subsections = (s: Section) =>
    s.subsections.map((x) => (
      <div key={x.id} className="mt-16">
        <SectionHeading id={x.id} num={x.num} title={x.title} level={3} />
        {x.paras.map((p) => row(p))}
      </div>
    ));

  const container = "mx-auto max-w-[1200px] px-5 md:px-8";

  return (
    <>
      <a href="#abstract" className="sr-only z-50 rounded-lg bg-ink px-4 py-2 text-newsprint focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        {ui.startReading}
      </a>
      <Header locale={locale} toc={toc} />
      <TocRail items={toc} label={ui.sections} />
      <main>
        <Hero locale={locale} card={HERO_CARD} />

        {/* Round's two-tone statement: the first sentence in ink, the rest in graphite */}
        <section id="statement" className="pb-24 pt-8 md:pb-32 md:pt-16">
          <div className="mx-auto max-w-[1200px] px-5 md:px-8">
            <p className="max-w-[36ch] font-display text-[clamp(24px,2.7vw,36px)] leading-[1.18] tracking-[-0.015em] text-balance">
              {ui.statementLead}
              <span className="text-ash">{ui.statementRest}</span>
            </p>
          </div>
        </section>

        {/* Abstract */}
        <section id="abstract" data-toc className="scroll-mt-24 pb-24 md:pb-32">
          <div className={container}>
            <div className={ROW}>
              <article className="rounded-xl border border-rule bg-paper p-6 shadow-[var(--shadow-card)] md:p-12">
                <p className="text-[15px] text-graphite">{ui.abstractLabel}</p>
                <p className="mt-3 font-display text-[clamp(24px,2.4vw,30px)] leading-[1.2] tracking-[-0.01em] text-balance">{ui.paperTitle}</p>
                <p className="mt-3 text-[16px] text-graphite">{paper.author}</p>
                <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-rule pt-4 text-[15px]">
                  <a href={ZENODO.record} target="_blank" rel="noopener noreferrer" className="arrow-link link inline-flex items-center gap-2 text-ink">
                    {ui.zenodo.record}
                    <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 11l6-6M6 5h5v5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </a>
                  <a href={ZENODO.pdf} className="arrow-link link inline-flex items-center gap-2 text-ink">
                    {ui.zenodo.pdf}
                    <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 3v8M4.5 7.5 8 11l3.5-3.5M3.5 13.5h9" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </a>
                  <a href={ZENODO.doiUrl} target="_blank" rel="noopener noreferrer" className="link font-mono text-[13px] text-graphite">
                    {ui.zenodo.doi} {ZENODO.doi}
                  </a>
                </div>
                <p className="mt-8 text-pretty"><Inline tokens={abstractTokens} locale={locale} /></p>
                {ui.translationNote && <p className="mt-6 border-t border-rule pt-4 text-[14px] text-graphite">{ui.translationNote}</p>}
              </article>
              <aside className="mt-8 lg:mt-0">
                <p className="text-[14px] font-medium text-amber-ink">{ui.shortVersionTitle}</p>
                <ol className="mt-3 grid gap-4">
                  {ui.shortVersion.map((line, i) => (
                    <li key={i} className="grid grid-cols-[24px_1fr] gap-2 text-[16px] leading-[1.5] text-graphite">
                      <span className="font-mono text-[13px] leading-6 text-ash">{i + 1}</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ol>
              </aside>
            </div>
          </div>
        </section>

        {paper.sections.map((s) => {
          if (s.id === "s3") {
            return (
              <section key={s.id} className="bg-pulp py-20 md:py-32">
                <div className={container}>
                  <SectionHeading id={s.id} num={s.num} title={s.title} level={2} />
                  <div className="mt-12 lg:max-w-[1080px]">
                    <StrategyGrid locale={locale} />
                  </div>
                  <div className="mt-8">{subsections(s)}</div>
                </div>
              </section>
            );
          }
          if (s.id === "s6") {
            const before = s.paras.filter((p) => Number(p.id.split("-p")[1]) < 7);
            const after = s.paras.filter((p) => Number(p.id.split("-p")[1]) > 10);
            const byId = new Map(s.paras.map((p) => [p.id, p]));
            const labels = { ...BAND_LABELS[locale], more: locale === "fr" ? "+{n} de plus" : "+{n} more" };
            return (
              <section key={s.id}>
                <div className={`${container} py-20 md:py-32`}>
                  <SectionHeading id={s.id} num={s.num} title={s.title} level={2} />
                  <div className="mt-10">{before.map((p) => row(p))}</div>
                </div>
                <div id="results" className="on-night scroll-mt-16 border-t border-night-rule bg-night pb-20 pt-24 text-night-text md:pb-32 md:pt-40">
                  <PhoneBand feed={FEED} labels={labels} start={toMinutes("09:50")}>
                    <div className="max-w-[640px] pb-8 pt-6 lg:pt-0">
                      <p className="font-display text-[clamp(32px,3.8vw,52px)] leading-[1.06] tracking-[-0.025em]">
                        {ui.bandLead}
                        <span className="mt-3 block text-night-text-2">{ui.bandRest.replace("{n}", String(FEED.length)).trim()}</span>
                      </p>
                      <p className="mt-6 text-[17px] leading-[1.55] text-night-text-2">{BAND_INTRO.body[locale]}</p>
                    </div>
                    {BAND.map((b) =>
                      b.kind === "para" ? (
                        <div key={b.id} data-t={toMinutes(b.t)} className="flex min-h-[24vh] scroll-mt-96 flex-col justify-center md:min-h-[30vh] lg:scroll-mt-24">
                          {(() => {
                            const p = byId.get(b.id);
                            if (!p) return null;
                            const notes = (ATTACH[p.id] ?? []).filter((a) => a.kind === "note");
                            return (
                              <>
                                <p id={p.id} className="max-w-[620px] text-pretty md:text-[18px]"><Inline tokens={tokens.get(p.id) ?? []} locale={locale} /></p>
                                <InlineNotes notes={notes.filter((n): n is Note => n.kind === "note")} locale={locale} tone="night" />
                              </>
                            );
                          })()}
                        </div>
                      ) : (
                        <div key={b.t} data-t={toMinutes(b.t)} className="flex min-h-[24vh] scroll-mt-96 flex-col justify-center md:min-h-[30vh] lg:scroll-mt-24">
                          <div className="max-w-[560px] border-t border-night-rule pt-4">
                            <p className="band-time font-mono text-[13px] tabular">{b.time[locale]}</p>
                            <p className="band-text mt-2 text-[19px] leading-[1.45]">{b.text[locale]}</p>
                          </div>
                        </div>
                      ),
                    )}
                  </PhoneBand>
                </div>
                <div className={`${container} py-20 md:py-32`}>{after.map((p) => row(p))}</div>
              </section>
            );
          }
          if (s.id === "s7") {
            const p = s.paras[0];
            const sentences = p.text.split(/(?<=\.)\s+/);
            const quote = sentences.at(-1) ?? "";
            return (
              <section key={s.id} className="border-t border-rule py-20 md:py-32">
                <div className={container}>
                  <SectionHeading id={s.id} num={s.num} title={s.title} level={2} />
                  <TextReveal text={quote} className="mt-12 max-w-[24ch] font-display text-[clamp(32px,4.6vw,64px)] leading-[1.05] tracking-[-0.02em] text-balance" />
                  <div className="mt-16">{row(p)}</div>
                </div>
              </section>
            );
          }
          return (
            <section key={s.id} className="py-20 md:py-32">
              <div className={container}>
                <SectionHeading id={s.id} num={s.num} title={s.title} level={2} />
                <div className="mt-10">{s.paras.filter((p) => !BAND_IDS.has(p.id)).map((p) => row(p))}</div>
                {subsections(s)}
              </div>
            </section>
          );
        })}

        <section id="works-cited" data-toc className="scroll-mt-24 border-t border-rule bg-paper py-20 md:py-32">
          <div className={container}>
            <h2 className="h2">{paper.worksTitle}</h2>
            <ol className="mt-10 gap-x-16 text-[15px] leading-[1.55] text-graphite lg:columns-2">
              {paper.works.map((w, i) => (
                <li key={i} id={`ref-${i + 1}`} className="mb-4 break-inside-avoid scroll-mt-24 break-words target:rounded-md target:bg-[color-mix(in_srgb,var(--color-amber)_14%,transparent)] target:text-ink">
                  {w}
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>
      <Footer locale={locale} author={paper.author} />
    </>
  );
}
