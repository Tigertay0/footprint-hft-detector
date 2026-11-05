# Picks (design-scout, 2026-11-04)

User answers: scroll-driven explainer; feel = precise and technical + calm and editorial; theme = light; language = English + French toggle.
Chosen: **Direction A, Margin Notes**, with the direction's own component set (no swaps).

## Direction
The paper set like a journal article, with a live margin: plain-language notes, animated figures and the phone sit beside the text they explain.

Tell-someone: "It's the site where the paper reads like a printed article, and the margin comes alive: the phone in the margin buzzes with the detector's real alerts as you read the results."

### Recipe
1. godly: Round → calm serif long-form type on a light ground (https://godly.design/website/round)
2. godly: Auxia → one dark band dropped into a light page, used as the phone's stage (https://godly.design/website/auxia)
3. 21st: Text Highlighter → marker sweep that lands on key numbers as you read
4. 21st: Table of Content (zanwei) → tick rail with section previews instead of a plain TOC

### What is new
The phone replays the detector's real alert stream (titles, bodies, priorities and emoji tags from `server/watcher.py` `build_message`), synced to the paragraph you are reading.

## Palette (light, restrained + one action)
| Name | Hex | Role |
|---|---|---|
| Newsprint | #F3EFE6 | ground |
| Ink | #17181C | text |
| Graphite | #5B5C63 | text 2 |
| Alert amber | #D9480F | action / the alert |
| Held green | #2B7A4B | brand 2 / cleared |
| Rule | #D8D2C4 | lines |

## Type
Display Zodiak / Text Sentient (serif) / Data JetBrains Mono.

## Motion idea
- Signature: phone pinned in the margin through Section 6 replays a real session (8 Oct) minute by minute as you scroll: amber early warnings drop in, 5 minutes later each flips to silent green "cleared" or red "confirmed".
- Scroll: margin figures draw as their paragraph enters.
- Interaction: hover a citation for the source; drag the alert dial.
- Ambient: faint graph-paper grid drifting in the hero only.

## Components (21st.dev)
| Code | Name | Author | URL | Category | Layer |
|---|---|---|---|---|---|
| A1 | Text Highlighter | danielpetho | https://21st.dev/@danielpetho/components/text-highlighter (id 18772) | text animation | scroll |
| A2 | Notification Stack Card | shadcnspace | https://21st.dev/@shadcnspace/components/card-26 (id 43164) | animated | signature |
| A3 | Inline Citations | kvnkld | https://21st.dev/@kvnkld/components/inline-citations (id 23585) | interactive | interaction |
| A4 | Table of Content | zanwei | https://21st.dev/@zanwei/components/table-of-content (id 22596) | navigation | interaction |
| A5 | Count Up | unlumen | https://21st.dev/@unlumen/components/count-up (id 20068) | numbers | scroll |
| A6 | Language Switcher Pill | mohitsapat | https://21st.dev/@mohitsapat/components/language-switcher-pill (id 39136) | interactive | interaction |
| A7 | Animated Grid | rmahammad | https://21st.dev/@rmahammad/components/animated-grid (id 29376) | background | ambient |

Board: `.design/scout/board.html`.
