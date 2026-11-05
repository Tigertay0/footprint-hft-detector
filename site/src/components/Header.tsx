"use client";
import { useEffect, useState } from "react";
import { UI, type Locale } from "@/content/i18n";
import { cn } from "@/lib/utils";
import { LanguageSwitch } from "./ui/LanguageSwitch";
import { SectionMenu, type TocItem } from "./ui/SectionMenu";

export function Header({ locale, toc }: { locale: Locale; toc: TocItem[] }) {
  const ui = UI[locale];
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);
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
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 h-16 border-b transition-[background-color,border-color] duration-300",
        scrolled ? "border-rule bg-newsprint/85 backdrop-blur-md" : "border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-full max-w-[1200px] items-center justify-between gap-4 px-5 md:px-8">
        <a href="#top" className="flex items-baseline gap-2 rounded-sm">
          <span className="font-display text-[18px] tracking-[-0.01em]">Adetayo Agueh</span>
          <span className="hidden text-[15px] text-graphite sm:inline">{ui.research}</span>
        </a>
        <div className="flex items-center gap-3">
          <SectionMenu items={toc} label={ui.sections} closeLabel={ui.close} />
          <LanguageSwitch locale={locale} label={ui.langLabel} />
        </div>
      </div>
      <div
        aria-hidden
        className="absolute bottom-[-1px] left-0 h-[2px] origin-left bg-amber"
        style={{ width: "100%", transform: `scaleX(${progress})` }}
      />
    </header>
  );
}
