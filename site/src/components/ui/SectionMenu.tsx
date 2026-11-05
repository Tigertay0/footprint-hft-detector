"use client";
// Sections menu for screens without the TOC rail (< 1280px).
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface TocItem {
  id: string;
  label: string;
  level: 1 | 2;
}

export function SectionMenu({ items, label, closeLabel }: { items: TocItem[]; label: string; closeLabel: string }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !button.current?.contains(t)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    panel.current?.querySelector<HTMLAnchorElement>("a")?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  return (
    <div className="relative xl:hidden">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="btn-key btn-key--sm px-2 text-[14px] sm:px-3"
      >
        <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h7" strokeLinecap="round" />
        </svg>
        <span className="sr-only sm:not-sr-only">{open ? closeLabel : label}</span>
      </button>
      <div
        ref={panel}
        id={panelId}
        hidden={!open}
        className="absolute right-0 top-11 max-h-[70svh] w-[min(320px,calc(100vw-40px))] overflow-auto rounded-xl border border-rule bg-paper p-2 shadow-[var(--shadow-lift)]"
      >
        <nav aria-label={label}>
          <ul>
            {items.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "block rounded-lg px-3 py-2 text-[15px] leading-snug transition-colors duration-150 hover:bg-pulp",
                    item.level === 2 ? "pl-7 text-graphite" : "text-ink",
                  )}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
