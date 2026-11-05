# Design System: research.adetayo.dev

Last updated: 2026-11-04 by studio-loop. Full rationale in `.design/brief.md`.

## Read
- Design Read: a published research paper for curious non-specialists and finance readers, in Read + Experience mode, with a printed-journal language and one dark "phone on the desk" band.
- Scene: a reader on a laptop or phone, in daylight, reading for 15-25 minutes. Primary theme: light (one dark band).
- Dials: DESIGN_VARIANCE 6 · MOTION_INTENSITY 6 · VISUAL_DENSITY 4 (long reading, figures carry the motion, text stays still).
- Thesis: the paper is the page; the margin explains it; the phone proves what the tool would actually do. Refuses the dark neon terminal and the PDF embed.

## Color tokens
| Token | Hex | Use |
|---|---|---|
| --newsprint | #F3EFE6 | page ground |
| --paper | #FBF9F4 | raised cards, figures |
| --pulp | #EAE5D9 | sunken ground (Section 3) |
| --ink | #17181C | text, action fill, focus ring |
| --graphite | #4E4F55 | secondary text |
| --ash | #62625D | meta text only |
| --rule | #D8D2C4 | hairlines, grid |
| --amber | #D9480F | alerts, highlights, push segments (never a button fill) |
| --amber-ink | #A63A0C | amber as text on light grounds |
| --amber-night | #F08A5D | amber as text on the night band (7.6:1) |
| --held | #246A41 | cleared / held / visible-in-minute-data |
| --urgent | #C92A2A | urgent and confirmed only |
| --night | #111214 | Section 6 band |
| --night-text | #ECE8DF | band text |
| --night-text-2 | #A9A69E | band secondary text |

## Type
| Role | Family | Source | License | Weights |
|---|---|---|---|---|
| Display | Zodiak | Fontshare (ITF) | ITF Free Font License (commercial + web OK) | 400, 400i, 500 |
| Text | Sentient | Fontshare (ITF) | ITF Free Font License | 400, 400i, 500, 600 |
| Data | JetBrains Mono | Google Fonts | OFL | 400, 500 |
| Phone UI | system-ui / Roboto | system | n/a | n/a |

Scale: display clamp(44px, 6.2vw, 88px)/1.0/-0.03em; h2 clamp(32px, 3.4vw, 48px)/1.1/-0.02em; h3 22px/1.3 600; body 19px (17px mobile)/1.62, 66ch; note 16/1.5; caption 14/1.5; meta 13/1.5; figures tabular-nums.

## Space, radius, depth
- Spacing: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 160.
- Layout >= 1280: rail 120 | text 680 | gap 64 | margin 336 (container 1200). Wide figures 1048.
- Radius: controls 8, cards 12, notifications 16, phone 44 / screen 34.
- Shadows: card `0 1px 2px rgba(23,24,28,.05), 0 8px 24px rgba(23,24,28,.06)`; lift `0 12px 32px rgba(23,24,28,.10)`; phone `0 32px 80px rgba(0,0,0,.5)`.

## Motion
- Ease `cubic-bezier(0.16, 1, 0.3, 1)`; 160 feedback, 200 menus, 400 entrances, 700 reveals.
- One ambient layer (hero grid), paused offscreen. Reduced motion renders final frames.

## Components (21st.dev, restyled)
Animated Grid 29376 · Notification Stack Card 43164 · Text Highlighter 18772 · Inline Citations 23585 · Table of Content 22596 · Count Up 20068 · Language Switcher Pill 39136 · Text Reveal Mask 19257.
