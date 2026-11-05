"use client";
// Signature moment: the Section 6 band. While the reader scrolls the results, the phone replays every ntfy
// notification the watcher would have sent on 8 October 2026. Each block in the text column carries data-t
// (minutes after midnight, New York time); the reading line's position between blocks sets the phone's clock.
import { Children, useEffect, useMemo, useRef, useState } from "react";
import { toMinutes } from "@/lib/time";
import { Phone, type PhoneLabels } from "./Phone";
import type { FeedItem } from "./ui/NotificationCard";

export interface BandLabels extends PhoneLabels {
  early: string;
  cleared: string;
  confirmed: string;
  phoneLabel: string;
}

const END = 16 * 60;


const clockOf = (t: number) => {
  const m = Math.floor(t);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

function useBandTime(ref: React.RefObject<HTMLElement | null>, start: number) {
  const [t, setT] = useState(start);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const line = window.innerHeight * 0.6;
      const nodes = Array.from(el.querySelectorAll<HTMLElement>("[data-t]"));
      const anchors = nodes.map((a) => ({
        y: a.getBoundingClientRect().top,
        t: Number(a.dataset.t),
      }));
      // The note whose block holds the reading line gets the amber edge.
      nodes.forEach((n) => {
        const r = n.getBoundingClientRect();
        n.dataset.active = String(r.top <= line && r.bottom > line);
      });
      anchors.push({ y: el.getBoundingClientRect().bottom - window.innerHeight * 0.45, t: END });
      let next = anchors[0]?.t ?? start;
      if (anchors.length && line >= anchors[0].y) {
        next = END;
        for (let i = 0; i < anchors.length - 1; i++) {
          const a = anchors[i];
          const b = anchors[i + 1];
          if (line >= a.y && line < b.y) {
            next = a.t + ((line - a.y) / Math.max(1, b.y - a.y)) * (b.t - a.t);
            break;
          }
        }
      }
      setT((prev) => (Math.floor(prev) === Math.floor(next) ? prev : next));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    const ro = new ResizeObserver(onScroll);
    ro.observe(el);
    ro.observe(document.body);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [ref, start]);
  return t;
}

export function PhoneBand({ feed, labels, start, children }: { feed: FeedItem[]; labels: BandLabels; start: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const t = useBandTime(ref, start);
  const timed = useMemo(() => feed.map((f) => ({ f, m: toMinutes(f.at) })), [feed]);
  const items = useMemo(() => timed.filter((x) => x.m <= t).map((x) => x.f), [timed, t]);
  const tally = useMemo(() => {
    let early = 0;
    let cleared = 0;
    let confirmed = 0;
    for (const it of items) {
      if (it.kind === "EARLY WARNING") early++;
      else if (it.kind === "CLEARED") cleared++;
      else if (it.kind === "CONFIRMED" || it.kind === "ALERT") confirmed++;
    }
    return { early, cleared, confirmed };
  }, [items]);
  const clock = clockOf(t);
  const [intro, ...rest] = Children.toArray(children);

  const tallies = (
    <dl className="grid grid-cols-3 gap-2 text-center">
      {[
        { label: labels.early, v: tally.early, dot: "bg-amber" },
        { label: labels.confirmed, v: tally.confirmed, dot: "bg-urgent" },
        { label: labels.cleared, v: tally.cleared, dot: "bg-held" },
      ].map((x) => (
        <div key={x.label} className="rounded-lg border border-night-rule px-2 py-2">
          <dd className="font-display text-[26px] leading-none tabular">{x.v}</dd>
          <dt className="mt-1 flex items-center justify-center gap-2 text-[12px] leading-tight text-night-text-2">
            <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${x.dot}`} />
            {x.label}
          </dt>
        </div>
      ))}
    </dl>
  );

  return (
    <div ref={ref} className="relative mx-auto max-w-[1200px] px-5 md:px-8">
      <div className="lg:grid lg:grid-cols-[minmax(0,680px)_336px] lg:justify-between lg:gap-16">
        <div className="relative">
          {intro}
          {/* Mini phone, docked under the header on narrow screens, after the band's headline */}
          <div className="sticky top-16 z-20 -mx-5 bg-night px-5 pb-3 pt-3 md:-mx-8 md:px-8 lg:hidden" aria-label={labels.phoneLabel} role="region">
            <div className="mx-auto max-w-[420px]">
              <Phone items={items} clock={clock} labels={labels} variant="mini" />
            </div>
            <div aria-hidden className="pointer-events-none absolute inset-x-0 -bottom-6 h-6 bg-gradient-to-b from-night to-transparent" />
          </div>
          {rest}
        </div>
        <aside className="hidden lg:block">
          <div className="sticky top-[calc(var(--header-h)+24px)] grid gap-4" aria-label={labels.phoneLabel} role="region">
            <Phone items={items} clock={clock} labels={labels} variant="full" />
            {tallies}
          </div>
        </aside>
      </div>
      <p className="sr-only">{`${clock}. ${labels.early}: ${tally.early}. ${labels.confirmed}: ${tally.confirmed}. ${labels.cleared}: ${tally.cleared}.`}</p>
    </div>
  );
}
