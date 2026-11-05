"use client";
// Citation popover. Adapted from kvnkld's Inline Citations (21st.dev id 23585): the paper's own
// author-year text is the trigger (no numbered chips), and the card shows the full Works Cited entry.
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";

interface CiteProps {
  label: string;
  entry: string;
  url: string | null;
  refId: string;
  openSource: string;
  sourceLabel: string;
}

const CARD_W = 340;
const GAP = 8;

type OpenBy = "hover" | "pin" | null;

export function Cite({ label, entry, url, refId, openSource, sourceLabel }: CiteProps) {
  const [openBy, setOpenBy] = useState<OpenBy>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: -9999, left: -9999 });
  const trigger = useRef<HTMLSpanElement>(null);
  const card = useRef<HTMLSpanElement>(null);
  const hoverTimer = useRef<number | undefined>(undefined);
  const frame = useRef(0);
  const cardId = useId();
  const open = openBy !== null;

  const place = useCallback(() => {
    const r = trigger.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.min(CARD_W, window.innerWidth - 32);
    const left = Math.min(Math.max(16, r.left), window.innerWidth - width - 16);
    const cardH = card.current?.offsetHeight ?? 160;
    const above = r.bottom + GAP + cardH > window.innerHeight && r.top - GAP - cardH > 0;
    setPos({ top: above ? r.top - GAP - cardH : r.bottom + GAP, left });
  }, []);

  // Place before paint so the card never flashes at its old position.
  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => {
      if (!frame.current) frame.current = requestAnimationFrame(() => { frame.current = 0; place(); });
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenBy(null);
        trigger.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!trigger.current?.contains(target) && !card.current?.contains(target)) setOpenBy(null);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      cancelAnimationFrame(frame.current);
      frame.current = 0;
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open, place]);

  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  const hover = (enter: boolean) => (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(
      () => setOpenBy((cur) => (cur === "pin" ? cur : enter ? "hover" : null)),
      enter ? 180 : 240,
    );
  };

  // A click pins a hover-opened card open; a click on a pinned card closes it.
  const toggle = () => {
    window.clearTimeout(hoverTimer.current);
    setOpenBy((cur) => (cur === "pin" ? null : "pin"));
  };

  const onBlur = (e: React.FocusEvent) => {
    const next = e.relatedTarget as Node | null;
    if (next && (trigger.current?.contains(next) || card.current?.contains(next))) return;
    setOpenBy(null);
  };

  return (
    <>
      {/* An inline span (not a <button>, which Chromium lays out as one block) so long author lists wrap with the sentence. */}
      <span
        ref={trigger}
        role="button"
        tabIndex={0}
        className="cite"
        aria-expanded={open}
        aria-controls={cardId}
        onClick={toggle}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
            e.preventDefault();
            toggle();
          }
        }}
        onBlur={onBlur}
        onPointerEnter={hover(true)}
        onPointerLeave={hover(false)}
      >
        {label}
      </span>
      <span
        ref={card}
        id={cardId}
        hidden={!open}
        onBlur={onBlur}
        onPointerEnter={hover(true)}
        onPointerLeave={hover(false)}
        style={{ top: pos.top, left: pos.left, width: `min(${CARD_W}px, calc(100vw - 32px))` }}
        className="fixed z-50 block rounded-xl border border-rule bg-paper p-4 text-left font-serif text-[15px] leading-normal text-ink shadow-[var(--shadow-lift)]"
      >
        <span className="mb-2 block text-[13px] font-medium text-amber-ink">{sourceLabel}</span>
        <span className="block break-words">{entry}</span>
        <span className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[14px]">
          {url && (
            <a className="link text-ink" href={url} target="_blank" rel="noopener noreferrer">
              {openSource}
            </a>
          )}
          <a className="link text-graphite" href={`#${refId}`} onClick={() => setOpenBy(null)}>
            #{refId.replace("ref-", "")}
          </a>
        </span>
      </span>
    </>
  );
}
