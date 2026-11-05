// Paper text with its margin: each paragraph row holds the text and, beside it on wide screens (below it on
// narrow ones), the plain-language notes. Figures follow their paragraph in the text column or span both columns.
import { UI, type Locale } from "@/content/i18n";
import { ATTACH, type Note } from "@/content/notes";
import type { Para } from "@/content/paper";
import type { Token } from "@/content/tokenize";
import { cn } from "@/lib/utils";
import { FigureById } from "./figures";
import { Inline } from "./Inline";

export const ROW = "lg:grid lg:grid-cols-[minmax(0,680px)_336px] lg:justify-between lg:gap-16";

/** Desktop sidenote: set in the margin like a printed journal's note, no box, a short neutral rule above. */
export function MarginNote({ note, locale, tone = "light" }: { note: Note; locale: Locale; tone?: "light" | "night" }) {
  const night = tone === "night";
  return (
    <aside className="mt-1 [&+&]:mt-8">
      <span aria-hidden className={cn("block h-px w-8", night ? "bg-night-text-2/40" : "bg-ink/30")} />
      <p className="mt-3 text-[16px] font-medium leading-snug">{note.title[locale]}</p>
      <p className={cn("mt-1 text-[15px] leading-[1.55]", night ? "text-night-text-2" : "text-graphite")}>{note.body[locale]}</p>
    </aside>
  );
}

/** Narrow screens: notes fold under the paragraph as terms you can open, so the paper text reads without breaks. */
export function InlineNotes({ notes, locale, tone = "light" }: { notes: Note[]; locale: Locale; tone?: "light" | "night" }) {
  if (notes.length === 0) return null;
  const night = tone === "night";
  return (
    <div className={cn("mt-4 border-b lg:hidden", night ? "border-night-rule" : "border-rule")}>
      {notes.map((n) => (
        <details key={n.title.en} className={cn("group border-t", night ? "border-night-rule" : "border-rule")}>
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-3 text-[15px] leading-snug [&::-webkit-details-marker]:hidden">
            <span>
              <span className={night ? "text-night-text-2" : "text-graphite"}>{UI[locale].plainLabel} · </span>
              <span className="font-medium">{n.title[locale]}</span>
            </span>
            <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={cn("shrink-0 transition-transform duration-200 ease-[var(--ease-premium)] group-open:rotate-45 motion-reduce:transition-none", night ? "text-night-text-2" : "text-graphite")}>
              <path d="M8 3v10M3 8h10" strokeLinecap="round" />
            </svg>
          </summary>
          <p className={cn("pb-4 text-[15px] leading-[1.55]", night ? "text-night-text-2" : "text-graphite")}>{n.body[locale]}</p>
        </details>
      ))}
    </div>
  );
}

interface ParaRowProps {
  para: Para;
  tokens: Token[];
  locale: Locale;
  figureNumbers: Map<string, string>;
  tone?: "light" | "night";
}

export function ParaRow({ para, tokens, locale, figureNumbers, tone = "light" }: ParaRowProps) {
  const attach = ATTACH[para.id] ?? [];
  const notes = attach.filter((a): a is Note => a.kind === "note");
  const figures = attach.filter((a) => a.kind === "figure");
  return (
    <>
      <div className={cn(ROW, "mt-6 first:mt-0")} id={para.id}>
        <div className="max-w-[680px]">
          <p className="text-pretty">
            <Inline tokens={tokens} locale={locale} />
          </p>
          <InlineNotes notes={notes} locale={locale} tone={tone} />
        </div>
        <div className="hidden lg:block">
          {notes.map((n) => (
            <MarginNote key={n.title.en} note={n} locale={locale} tone={tone} />
          ))}
        </div>
      </div>
      {figures.map((f) =>
        f.kind === "figure" ? (
          <div key={f.id} className={cn("my-12", f.wide ? "lg:max-w-[1080px]" : ROW)}>
            <div className={f.wide ? undefined : "max-w-[680px]"}>
              <FigureById id={f.id} locale={locale} n={figureNumbers.get(f.id) ?? ""} />
            </div>
          </div>
        ) : null,
      )}
    </>
  );
}

export function SectionHeading({ id, num, title, level }: { id: string; num: string; title: string; level: 2 | 3 }) {
  if (level === 2) {
    return (
      <h2 id={id} data-toc className="h2 max-w-[22ch] text-balance">
        {num}. {title}
      </h2>
    );
  }
  return (
    <h3 id={id} data-toc className="h3 mt-16 mb-6 first:mt-0">
      {num} {title}
    </h3>
  );
}
