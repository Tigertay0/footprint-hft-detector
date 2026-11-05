"use client";
// Section rail. Adapted from zanwei's Table of Content (21st.dev id 22596): one tick per heading, the active
// tick grows and turns amber, hovering or focusing a tick shows its title. Shown from 1280px up.
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { TocItem } from "./SectionMenu";

export function TocRail({ items, label }: { items: TocItem[]; label: string }) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => {
      let id: string | null = null;
      for (const item of items) {
        const el = document.getElementById(item.id);
        if (el && el.getBoundingClientRect().top < window.innerHeight * 0.35) id = item.id;
      }
      setActive(id);
    };
    let frame = 0;
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; onScroll(); });
    };
    onScroll();
    window.addEventListener("scroll", schedule, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
    };
  }, [items]);

  return (
    <nav
      aria-label={label}
      className="fixed left-6 top-1/2 z-30 hidden -translate-y-1/2 xl:block"
    >
      <ul className="flex flex-col gap-3">
        {items.map((item) => {
          const on = item.id === active;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={on ? "location" : undefined}
                className="group relative flex h-3 items-center"
              >
                <span
                  aria-hidden
                  className={cn(
                    "block h-[2px] w-6 origin-left rounded-full transition-[transform,background-color] duration-300 ease-[var(--ease-premium)]",
                    on
                      ? "scale-x-100 bg-amber"
                      : item.level === 1
                        ? "scale-x-[0.66] bg-graphite/60 group-hover:scale-x-100 group-hover:bg-ink"
                        : "scale-x-[0.33] bg-rule group-hover:scale-x-[0.8] group-hover:bg-graphite",
                  )}
                />
                <span
                  className={cn(
                    "pointer-events-none absolute left-9 whitespace-nowrap rounded-lg border border-rule bg-paper px-3 py-1 text-[13px] text-ink opacity-0 shadow-[var(--shadow-card)] transition-[opacity,transform] duration-200 ease-[var(--ease-premium)] -translate-x-1",
                    "group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100",
                  )}
                >
                  {item.label}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
