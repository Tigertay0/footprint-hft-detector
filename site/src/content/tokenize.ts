import { CITATIONS, frenchRunning, type CitationAlias } from "./citations";
import type { Locale } from "./i18n";

export interface WorkRef {
  id: string;
  text: string;
  url: string | null;
}

export type Token =
  | { t: "text"; v: string }
  | { t: "cite"; v: string; ref: WorkRef }
  | { t: "mark"; v: string };

interface Span {
  start: number;
  end: number;
  token: Token;
}

const PAREN_RE = /\(([^()]+)\)/g;

const TRAILING = /[.,;)]+$/;

export function workUrl(entry: string): string | null {
  const doi = entry.match(/doi:(10\.\S+)/);
  if (doi) return `https://doi.org/${doi[1].replace(TRAILING, "")}`;
  const host = entry.match(/\b((?:[a-z0-9-]+\.)+(?:gov|org|com|edu|net|in|io)(?![a-z0-9-])(?:\/\S*)?)/i);
  if (!host) return null;
  return `https://${host[1].replace(TRAILING, "")}`;
}

export function buildRefs(works: string[]): Map<string, WorkRef> {
  const refs = new Map<string, WorkRef>();
  for (const alias of CITATIONS) {
    const hits = works.flatMap((w, i) => (w.includes(alias.key) ? [i] : []));
    if (hits.length !== 1) throw new Error(`"${alias.key}" (for ${alias.cite}) matches ${hits.length} Works Cited entries, expected 1`);
    const index = hits[0];
    refs.set(alias.cite, { id: `ref-${index + 1}`, text: works[index], url: workUrl(works[index]) });
  }
  return refs;
}

function overlaps(spans: Span[], start: number, end: number): boolean {
  return spans.some((s) => start < s.end && end > s.start);
}

function parentheticalCites(text: string, refs: Map<string, WorkRef>): Span[] {
  const spans: Span[] = [];
  for (const m of text.matchAll(PAREN_RE)) {
    const innerStart = (m.index ?? 0) + 1;
    let offset = 0;
    for (const part of m[1].split(";")) {
      const lead = part.length - part.trimStart().length;
      const cite = part.trim();
      const ref = refs.get(cite);
      if (ref) {
        const start = innerStart + offset + lead;
        spans.push({ start, end: start + cite.length, token: { t: "cite", v: cite, ref } });
      }
      offset += part.length + 1;
    }
  }
  return spans;
}

function runningCites(text: string, refs: Map<string, WorkRef>, locale: Locale, seen: Set<string>, taken: Span[]): Span[] {
  const spans: Span[] = [];
  const running: CitationAlias[] = CITATIONS.filter((c) => c.running).sort((a, b) => b.cite.length - a.cite.length);
  for (const alias of running) {
    if (seen.has(alias.cite)) continue;
    const variants = locale === "fr" ? [frenchRunning(alias.cite), alias.cite] : [alias.cite];
    const ref = refs.get(alias.cite);
    if (!ref) continue;
    let found = false;
    for (const name of variants) {
      for (let start = text.indexOf(name); start !== -1 && !found; start = text.indexOf(name, start + 1)) {
        const end = start + name.length;
        if (overlaps(taken, start, end) || overlaps(spans, start, end)) continue;
        spans.push({ start, end, token: { t: "cite", v: name, ref } });
        seen.add(alias.cite);
        found = true;
      }
      if (found) break;
    }
  }
  return spans;
}

/**
 * Splits one paragraph into text, citation and highlight tokens.
 * `seen` carries the running-name mentions already linked in this section.
 */
export function tokenize(
  text: string,
  opts: { refs: Map<string, WorkRef>; locale: Locale; seen: Set<string>; marks?: string[] },
): Token[] {
  const spans = parentheticalCites(text, opts.refs);
  spans.push(...runningCites(text, opts.refs, opts.locale, opts.seen, spans));
  for (const mark of opts.marks ?? []) {
    for (let start = text.indexOf(mark); start !== -1; start = text.indexOf(mark, start + 1)) {
      if (overlaps(spans, start, start + mark.length)) continue;
      spans.push({ start, end: start + mark.length, token: { t: "mark", v: mark } });
      break;
    }
  }
  spans.sort((a, b) => a.start - b.start);

  const tokens: Token[] = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.start > cursor) tokens.push({ t: "text", v: text.slice(cursor, span.start) });
    tokens.push(span.token);
    cursor = span.end;
  }
  if (cursor < text.length) tokens.push({ t: "text", v: text.slice(cursor) });
  return tokens;
}
