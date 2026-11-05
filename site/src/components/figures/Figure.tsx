import { cn } from "@/lib/utils";

interface FigureProps {
  label: string;
  title: string;
  caption?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  tone?: "paper" | "night";
}

/** Paper card with a numbered label, a title and a caption under the drawing. */
export function Figure({ label, title, caption, children, className, tone = "paper" }: FigureProps) {
  const night = tone === "night";
  return (
    <figure
      className={cn(
        "rounded-xl border p-5 md:p-6",
        night ? "border-night-rule bg-night-2 text-night-text" : "border-rule bg-paper shadow-[var(--shadow-card)]",
        className,
      )}
    >
      <p className={cn("font-mono text-[12px]", night ? "text-night-text-2" : "text-ash")}>{label}</p>
      <p className="mt-1 font-display text-[22px] leading-tight tracking-[-0.01em] md:text-[24px]">{title}</p>
      <div className="mt-5">{children}</div>
      {caption && (
        <figcaption className={cn("mt-4 text-[14px] leading-normal", night ? "text-night-text-2" : "text-graphite")}>
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
