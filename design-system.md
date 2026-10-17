# Design System: Footprint (HFT footprint detector)

Last updated: 2026-10-12 by design-build

## Read
- Design Read: Reading this as: a market-surveillance explainer for retail investors and research readers, in Operate mode with Read-style explanations, with a calm evidence-first "case file" language, leaning toward a cool-paper light UI where color is reserved for risk.
- Mode: Operate (the Guide tab is Read)
- Scene: A student or retail investor at a laptop, usually in daylight or an evening session, who wants to know whether a spike was suspicious and why. Primary theme: light. Dark ships through the same tokens (app UI ships both).
- Dials: DESIGN_VARIANCE 3 · MOTION_INTENSITY 3 · VISUAL_DENSITY 6 (data tool with plain-English explanations, so denser than a landing page but not a cockpit)
- Thesis: Color means risk, and every flag shows its working. Refuses the generic trading terminal (dark, candlesticks, neon) and the generic AI dashboard (KPI tiles): one verdict sentence, one annotated chart, evidence rows that say in words what was unusual.
- Apple design loaded: no (not gesture-driven, not asked for)

## References
| # | Reference | Gallery link | Live link | Capture | Mechanisms taken |
|---|---|---|---|---|---|
| 1 | Plausible Analytics live demo | none (direct) | https://plausible.io/plausible.io | viewed in the in-app browser, not saved to disk | One primary chart is the hero of the page; plain-language metric names; a period control top right |
| 2 | Rerun | https://godly.design/websites/ | https://rerun.io/ | viewed in the in-app browser, not saved to disk | One filled button per screen and everything else text-only; quiet small nav |
| 3 | Lightspark | https://godly.design/websites/ | https://www.lightspark.com/ | captured mid-load, so only the nav was usable | Small nav type with wide gutters; near-black ink on a pale cool ground |

SaaSFrame and Land-book were not queried in this run, so the set leans on godly.design plus one known live demo.

Synthesis:
1. One chart is the hero, and it carries the interaction (select an alert, the chart zooms to it).
2. One filled button per screen (Scan, Start replay, Run test). Everything else is outline or text.
3. Color is data: amber means Elevated, red means High. Interface chrome is ink on cool neutrals only.
4. Words before numbers: the headline is a sentence, each alert opens with plain-English reasons, numbers follow as evidence.
5. Quiet navigation with generous gutters; five top-level items (Scan, Replay, Alerts, Accuracy, Guide). The Alerts tab reuses the replay log rows and the summary strip, and turns the strip red-tinted when the watcher is not running, because a silent watcher must never read as a quiet market.

## Color
- Strategy: Restrained (neutrals plus risk colors with a fixed meaning)
- Tokens (light / dark):
  - --ground: #ECEFF3 / #0E1217
  - --surface: #F7F8FA / #151A21
  - --sunken: #E1E6EC / #1E252E
  - --ink (text-primary): #11161D / #E7EBF1
  - --ink-2 (text-secondary): #3D4856 / #B4BDCA
  - --ink-3 (text-tertiary): #566271 / #96A2B2
  - --line: rgba(17,22,29,.13) / rgba(231,235,241,.14)
  - --on-ink (text on the primary button): #F2F4F7 / #11161D
  - --elevated: #B87200 / #E5A93B; --elevated-ink on --elevated-tint: #5C3A00 on #F5E3B8 / #F2CB78 on a 16% amber tint
  - --high: #CC3524 / #EE6F5E; --high-ink on --high-tint: #7A1B0E on #F5D2CA / #F7A094 on a 17% red tint
- Accent rules: no brand accent. The primary button is ink-filled. Amber and red appear only on data marks, pills and bars for Elevated and High. Elevated and High also differ by size and by text label, never by color alone.
- Verified contrast (computed, WCAG): ink/ground 15.75 and 15.70, ink-2/ground 8.06 and 9.91, ink-3/surface 5.84 and 6.75, on-ink/ink 16.48 and 15.18, elevated-ink/elevated-tint 8.04 and 8.37, high-ink/high-tint 7.51 and 6.86. Marks against surface (need 3): bar 3.48 and 4.12, elevated 3.63 and 8.38, high 4.82 and 5.88.

## Typography (Fontesk)
| Role | Family | Fontesk URL | License | Web embed OK | Weights shipped |
|---|---|---|---|---|---|
| Display and text | Schibsted Grotesk (Bakken & Baeck for Schibsted) | https://fontesk.com/schibsted-grotesk-typeface/ | SIL OFL 1.1, free for commercial use | yes (OFL; license kept at web/fonts/schibsted-grotesk/OFL.txt) | variable 400-900, upright only, WOFF2 70 KB |

- Fallback stack: "Schibsted Grotesk", "Schibsted Grotesk Fallback" (Arial with size-adjust 101%, ascent 93%, descent 24%), system-ui, sans-serif
- Scale: display clamp(1.75rem, 1.15rem + 1.7vw, 2.75rem) / 1.08 / -0.025em / 700; h2 1.1875rem / 1.25 / -0.012em / 650; body 1rem / 1.55 / 0 / 400; small 0.875rem; label 0.8125rem / 650
- Numerals: tabular figures only on data (`.num`, readouts, pills, chart text). This font also widens punctuation under `tnum`, so it is never set on body text.
- Measure: body max 62-70ch
- Rules: headlines balance-wrapped; one family only; no eyebrow labels, no mono

## Space and layout
- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64
- Container: 1280px, gutters 16px mobile and 32px from 768px
- Grid: results use one column below 1024px, then a fluid main column plus a 400px sticky alert column
- First viewport (Scan, before a result): control bar (ticker, data source, window, one primary Scan button at the far right), then a left-aligned headline and a three-row legend of what Elevated, High and Normal mean. After a result: the verdict sentence replaces the headline, the session strip and chart sit left, the ranked alert list sits right.

## Shape and depth
- Radius lock: controls 8px, panels 12px, pills full
- Borders: 1px --line. Panels are surface fill with a hairline, no shadow. Only the segmented-control thumb has a small tinted shadow.
- No nested cards. Alert rows are divided by hairlines inside one panel.

## Motion
- Easing: --ease-out cubic-bezier(0.23, 1, 0.32, 1); --ease-in-out cubic-bezier(0.77, 0, 0.175, 1)
- Durations: press 120ms, fast 160ms, medium 240ms; chart zoom 360ms (ease-out cubic)
- Signature moment: selecting an alert zooms the chart to its window and opens its evidence. It shows where the alert sits in the day, which is the point of the page.
- Never animated: keyboard cursor movement on the chart, tab changes, list re-sorts
- Reduced motion: zoom jumps, thumb glide and message entrance are removed, playback shows the latest computed minute

## Components (21st.dev)
| Component | Source URL | Changes made |
|---|---|---|
| Segmented control | https://21st.dev/@kuratlielia/components/segmented-control | Mechanism ported (gliding highlight, roving tab stop, arrow/Home/End keys) from React + Motion to plain DOM and a CSS transform. Restyled to tokens, 38px tall (44px on touch), no scroll fade because the options are few. |
| Alert list and replay log | hand-built (21st.dev Timeline at https://21st.dev/@kuratlielia/components/timeline was found by search, but its code was not retrieved) | Plain lists. New messages enter with a short opacity and 6px rise via `@starting-style`, and only the new item animates. No connector line, no icons. |

The app is vanilla JS with no build step, so 21st.dev React code could not be dropped in as-is.

## Icons and imagery
- Icon library: Phosphor (MIT), regular weight, inlined as an SVG sprite at web/icons.svg. Sizes 16 and 20.
- Imagery: none. The page is data.

## Browser surfaces
- ::selection ink on on-ink, focus ring 2px ink with 2px offset, caret default, link underline offset 0.2em, thin scrollbars on the session strip

## Project-specific bans
- No green for "good" and no red for price down: color is reserved for risk level.
- No claim of proof. Every alert surface says it is a warning sign, not proof of manipulation, and the footer says it is not investment advice.
- No fake data presented as real: Sample data is labelled "Sample data" and planted events are labelled as planted.
