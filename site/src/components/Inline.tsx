import type { Token } from "@/content/tokenize";
import { UI, type Locale } from "@/content/i18n";
import { Cite } from "./ui/Cite";
import { Mark } from "./ui/Mark";

export function Inline({ tokens, locale }: { tokens: Token[]; locale: Locale }) {
  const ui = UI[locale];
  return (
    <>
      {tokens.map((tk, i) => {
        if (tk.t === "text") return <span key={i}>{tk.v}</span>;
        if (tk.t === "mark") return <Mark key={i}>{tk.v}</Mark>;
        return (
          <Cite
            key={i}
            label={tk.v}
            entry={tk.ref.text}
            url={tk.ref.url}
            refId={tk.ref.id}
            openSource={ui.openSource}
            sourceLabel={ui.sourceLabel}
          />
        );
      })}
    </>
  );
}
