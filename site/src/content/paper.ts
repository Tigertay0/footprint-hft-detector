import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Locale } from "./i18n";

export interface Para {
  id: string;
  text: string;
}

export interface Subsection {
  id: string;
  num: string;
  title: string;
  paras: Para[];
}

export interface Section {
  id: string;
  num: string;
  title: string;
  paras: Para[];
  subsections: Subsection[];
}

export interface Paper {
  author: string;
  abstract: string;
  sections: Section[];
  works: string[];
  worksTitle: string;
}

const SOURCES: Record<Locale, string> = {
  en: path.join(process.cwd(), "..", "research", "paper", "paper_full.md"),
  fr: path.join(process.cwd(), "content", "paper.fr.md"),
};

const SECTION_RE = /^##\s+(\d+)\.\s+(.+)$/;
const SUBSECTION_RE = /^###\s+(\d+\.\d+)\s+(.+)$/;
const WORKS_RE = /^##\s+(Works Cited|Ouvrages cités)\s*$/i;

/** Splits the manuscript into blocks separated by blank lines. */
function blocks(markdown: string): string[] {
  return markdown
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
}

export function parsePaper(markdown: string): Paper {
  const [author = "", abstract = "", ...rest] = blocks(markdown);
  const sections: Section[] = [];
  const works: string[] = [];
  let worksTitle = "Works Cited";
  let mode: "body" | "works" = "body";

  for (const block of rest) {
    const worksMatch = block.match(WORKS_RE);
    if (worksMatch) {
      mode = "works";
      worksTitle = worksMatch[1];
      continue;
    }
    if (mode === "works") {
      works.push(block);
      continue;
    }
    const sec = block.match(SECTION_RE);
    if (sec) {
      sections.push({ id: `s${sec[1]}`, num: sec[1], title: sec[2].trim(), paras: [], subsections: [] });
      continue;
    }
    const current = sections.at(-1);
    if (!current) throw new Error(`Paper text before the first section: "${block.slice(0, 60)}"`);
    const sub = block.match(SUBSECTION_RE);
    if (sub) {
      current.subsections.push({ id: `s${sub[1].replace(".", "-")}`, num: sub[1], title: sub[2].trim(), paras: [] });
      continue;
    }
    const lastSub = current.subsections.at(-1);
    if (lastSub) {
      lastSub.paras.push({ id: `${lastSub.id}-p${lastSub.paras.length + 1}`, text: block });
    } else {
      current.paras.push({ id: `${current.id}-p${current.paras.length + 1}`, text: block });
    }
  }
  return { author, abstract, sections, works, worksTitle };
}

const cache = new Map<Locale, Paper>();

export function getPaper(locale: Locale): Paper {
  const hit = cache.get(locale);
  if (hit) return hit;
  const paper = parsePaper(readFileSync(SOURCES[locale], "utf8"));
  cache.set(locale, paper);
  return paper;
}

/** Fails the build if the French file drifts from the English structure (notes and figures attach by paragraph id). */
export function assertSameShape(a: Paper, b: Paper): void {
  const shape = (p: Paper) =>
    p.sections.map((s) => `${s.id}:${s.paras.length}[${s.subsections.map((x) => `${x.id}:${x.paras.length}`).join(",")}]`).join(" ");
  if (shape(a) !== shape(b)) {
    throw new Error(`EN and FR papers differ in structure:\nEN ${shape(a)}\nFR ${shape(b)}`);
  }
  if (a.works.length !== b.works.length) {
    throw new Error(`Works cited count differs: EN ${a.works.length}, FR ${b.works.length}`);
  }
}
