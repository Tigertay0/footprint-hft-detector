"use client";
// EN / FR switch. Adapted from mohitsapat's Language Switcher Pill (21st.dev id 39136): a sliding thumb,
// restyled to 8px radius, no flags. The options are links to the other page (they navigate), with
// aria-current on the active one. Following a link keeps the reader's section (#hash).
import { HOME, LOCALES, type Locale } from "@/content/i18n";
import { cn } from "@/lib/utils";

const LABELS: Record<Locale, { short: string; long: string }> = {
  en: { short: "EN", long: "English" },
  fr: { short: "FR", long: "Français" },
};

export function LanguageSwitch({ locale, label, tone = "light" }: { locale: Locale; label: string; tone?: "light" | "night" }) {
  const follow = (next: Locale) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (next === locale || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const section = currentSection();
    if (!section) return;
    e.preventDefault();
    window.location.assign(`${HOME[next]}#${section}`);
  };

  const active = LOCALES.indexOf(locale);
  return (
    <nav
      aria-label={label}
      className={cn(
        "relative grid h-8 grid-cols-2 rounded-lg p-1 font-mono text-[12px]",
        tone === "night" ? "bg-night-2" : "bg-pulp",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute bottom-1 left-1 top-1 w-[calc(50%-4px)] rounded-[4px] transition-transform duration-300 ease-[var(--ease-premium)] motion-reduce:transition-none",
          tone === "night" ? "bg-night-rule" : "bg-paper shadow-[0_1px_2px_rgba(23,24,28,.12)]",
        )}
        style={{ transform: `translateX(${active * 100}%)` }}
      />
      {LOCALES.map((l) => {
        const on = l === locale;
        return (
          <a
            key={l}
            href={HOME[l]}
            hrefLang={l}
            lang={l}
            aria-current={on ? "true" : undefined}
            title={LABELS[l].long}
            onClick={follow(l)}
            className={cn(
              "relative z-10 grid min-w-10 place-items-center rounded-[4px] px-2 transition-colors duration-200",
              on
                ? tone === "night" ? "font-medium text-night-text" : "font-medium text-ink"
                : tone === "night" ? "text-night-text-2 hover:text-night-text" : "text-graphite hover:text-ink",
            )}
          >
            <span aria-hidden>{LABELS[l].short}</span>
            <span className="sr-only">{LABELS[l].long}</span>
          </a>
        );
      })}
    </nav>
  );
}

/** The id of the last section or subsection heading above the reading line. */
function currentSection(): string | null {
  const heads = Array.from(document.querySelectorAll<HTMLElement>("[data-toc]"));
  let id: string | null = null;
  for (const h of heads) {
    if (h.getBoundingClientRect().top < window.innerHeight * 0.35) id = h.id;
  }
  return id;
}
