// One ntfy notification as Android shows it. The card shape appears only in the hero and on the phone.
import { cn } from "@/lib/utils";

export interface FeedItem {
  id?: number;
  at: string;
  ticker: string | null;
  kind: string;
  title: string;
  body: string;
  priority: number;
  tags: string[];
}

// ntfy shows these tags as emoji in front of the title.
const TAG_EMOJI: Record<string, string> = {
  warning: "⚠️",
  rotating_light: "🚨",
  white_check_mark: "✅",
  zzz: "💤",
};

export function tagPrefix(tags: string[]): string {
  return tags.map((t) => TAG_EMOJI[t] ?? "").join("");
}

interface Props {
  item: Pick<FeedItem, "title" | "body" | "priority" | "tags" | "at">;
  appLabel: string;
  timeLabel?: string;
  compact?: boolean;
  full?: boolean;
  className?: string;
}

export function NotificationCard({ item, appLabel, timeLabel, compact, full, className }: Props) {
  const urgent = item.priority >= 5;
  const quiet = item.priority <= 2;
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl bg-white/[0.96] text-left font-phone text-[#1d1d20] shadow-[0_1px_2px_rgba(0,0,0,.2)]",
        quiet && "bg-white/[0.82] text-[#3a3a3e]",
        compact ? "px-3 py-2" : "px-4 py-3",
        className,
      )}
    >
      {urgent && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-urgent" />}
      <div className="flex items-center gap-2 text-[11px] leading-4 text-[#5f6368]">
        <BellGlyph />
        <span>{appLabel}</span>
        <span aria-hidden>·</span>
        <span className="tabular">{timeLabel ?? item.at}</span>
        {urgent && <span className="ml-auto font-medium text-urgent">Urgent</span>}
      </div>
      <p className={cn("mt-1 font-semibold leading-[18px]", compact ? "text-[13px]" : "text-[14px]")}>
        {tagPrefix(item.tags)} {item.title}
      </p>
      {!compact && <p className={cn("mt-1 whitespace-pre-line", !full && "line-clamp-3", " text-[13px] leading-[18px] text-[#3c4043]")}>{item.body}</p>}
    </div>
  );
}

function BellGlyph() {
  return (
    <span aria-hidden className="grid h-4 w-4 place-items-center rounded-[4px] bg-[#2b6f62]">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path d="M5 1.2c-1.5 0-2.6 1.1-2.6 2.6v1.7L1.6 7h6.8l-.8-1.5V3.8C7.6 2.3 6.5 1.2 5 1.2Z" fill="#fff" />
        <path d="M4 8.1a1 1 0 0 0 2 0" stroke="#fff" strokeWidth=".9" />
      </svg>
    </span>
  );
}
