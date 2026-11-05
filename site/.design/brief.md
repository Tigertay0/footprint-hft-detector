# Design Brief: research.adetayo.dev (HFT manipulation paper)

## 0. Job
- Type: Scroll experience (secondary: Read, a long-form article people actually read to the end)
- Builder mode for averlo-studio: scroll
- Core function: publish Adetayo Agueh's paper on HFT manipulation and a retail warning tool, in full, with plain-language notes and animated figures, in English and French.
- Primary action: "Start reading" (jumps to the abstract). The page's real goal is that the reader gets through Section 6.
- What the visitor must believe by the end: manipulation at machine speed is real but mostly invisible to retail investors; a simple detector on free minute data alerts about five times a stock a day, which is a setting and not proof, so a flag means "wait and look", not "chase the move".
- Existing brand to keep: none for the site. The detector app's tokens (`../design-system.md`) are not reused: this is a publication, not the tool.
- Stack: Next.js (App Router, static export), Tailwind v4, Motion (`motion/react`). Routes `/` (EN) and `/fr/` (FR). No server.

## 1. Direction
- Character: exact, unhurried, quietly alarming.
- World: a printed financial journal on newsprint, with a trader's phone lying next to it that keeps buzzing.
- Theme: light (newsprint) with one dark band in Section 6 that is the phone's stage. Differs from the last registry row (KRAG One: dark warm graphite, ember, Archivo sans, split product hero, SVG gate) on theme, palette, display type (serif), hero device and signature motion.
- Palette strategy and method: Restrained base + 3 colour moments, tonal + contrast: warm newsprint neutrals in 5 steps, contrasted by Alert amber; Held green and Confirmed red carry meaning only.
- Signature moment: in Section 6 the page drops into a near-black band; the phone stays pinned while you scroll, and the detector's real 8 October 2026 session replays on it minute by minute: amber early warnings drop in and pile up, five minutes later each flips to a silent "cleared" or an urgent "confirmed", the hourly limit kicks in, and at 16:00 the "market closed" summary lands. Scrolling back rewinds it.
- Supporting moments:
  1. Hero (signature-lite, once): a one-minute price line draws across the hero, spikes, snaps back, and a single notification slides down onto the paper: "TSLA: possible HFT activity".
  2. Scroll: amber marker sweeps land on the key numbers as they enter ($3.49 vs $1.92, 4.9 a day, 28 percent, 78 percent).
  3. Interaction: the alert dial (gate 90 / 95 / 99 percentile x cut-off 40 / 50 / 60) changes "alerts per stock per day" live, from the paper's controls table.
  4. Interaction: the Isolation Forest figure: press "Cut again" and watch random cuts isolate the odd minute in fewer splits than a normal one.
- Tell-someone sentence: "It's the site where the paper reads like a printed article, and a phone in the margin buzzes with the detector's real alerts as you read the results."
- Signature detail: the ntfy notification card. It appears only in the hero (one card) and on the phone. Nowhere else uses that card shape.
- The rut we refuse: the dark neon trading-terminal look, candlestick wallpaper, PDF-embed paper pages, stock photos of traders, and "AI fintech" gradients.
- References (mechanisms taken, never layouts):
  - Round, https://godly.design/website/round: calm serif long-form type on a light ground, generous measure.
  - Auxia, https://godly.design/website/auxia: a cream page that drops into one full-bleed dark band; here the band is the phone's stage.
  - 21st Text Highlighter (danielpetho): marker sweep, used only on numbers that carry an argument.
  - 21st Table of Content (zanwei): a tick rail with previews instead of a list TOC.
  - Fusion: none of the references combine a journal-set paper with a live device in its margin. What is new is the phone replaying real output of the paper's own code, synced to the text.

## 2. Color
| Role | Hex | Notes |
|---|---|---|
| Primary brand (source hue) | #D9480F Alert amber | warm signal; everything else is tinted toward it |
| Background (page) | #F3EFE6 Newsprint | warm near-white |
| Surface raised | #FBF9F4 Paper | figure cards, citation cards, abstract card |
| Surface sunken | #EAE5D9 Pulp | Section 3 specimen ground, code/data wells |
| Text primary | #17181C Ink | body and headings |
| Text secondary | #4E4F55 Graphite | margin notes, captions (must reach 7:1 on Newsprint) |
| Text muted | #62625D Ash | meta only, never body (4.5:1 minimum on Newsprint and Paper) |
| Hairline | #D8D2C4 Rule | rules, grid, card borders (1px) |
| Brand 1 | #D9480F Alert amber | alerts in figures, marker highlights (at 22 percent alpha behind Ink text), the push in charts, active TOC tick |
| Brand 1 text | #A63A0C Amber ink | amber used as text on light grounds (4.5:1+) |
| Brand 2 | #246A41 Held green | "cleared", "visible in minute data" verdicts, moves that held |
| Band | #111214 Night desk | the Section 6 band ground; band text #ECE8DF, band text 2 #A9A69E |
| Action color | #17181C Ink | primary button fill ("Start reading"), language switch thumb, focus ring (2px, offset 2px; #ECE8DF on the band) |
| Text on action | #F3EFE6 | 15:1+ |
| Semantic: urgent / confirmed | #C92A2A | urgent notifications and "confirmed" only |
| Semantic: warning | #D9480F | = Alert amber (early warnings are the warning) |
| Semantic: quiet / cleared | #2B7A4B | = Held green |
Theme(s): light, with the dark band in Section 6. No site-wide dark mode (the paper metaphor is the point); the band carries the dark moment.

## 3. Typography
- Families (3, deliberate: the user approved this pairing on the board; mono is data only):
  - Display: Zodiak (Indian Type Foundry, Fontshare, ITF Free Font License, free for commercial and web use). Self-host WOFF2 400, 400 italic, 500.
  - Text: Sentient (ITF, Fontshare, same license). Self-host WOFF2 400, 400 italic, 500, 600.
  - Data: JetBrains Mono (OFL) via `next/font/google`, 400 and 500, tabular.
  - Phone UI only: `system-ui, Roboto, "Segoe UI", sans-serif` (a phone looks like a phone).
| Role | Size (desktop / mobile) | Line height | Tracking | Weight |
|---|---|---|---|---|
| Hero display (Zodiak) | clamp(44px, 6.2vw, 88px) | 1.0 | -0.03em | 400 (italic 400 for one emphasized phrase) |
| Paper title (Zodiak) | 24px / 20px | 1.25 | -0.01em | 500 |
| H2 section (Zodiak) | clamp(32px, 3.4vw, 48px) | 1.1 | -0.02em | 400 |
| H3 subsection (Sentient) | 22px / 20px | 1.3 | -0.01em | 600 |
| Body (Sentient) | 19px / 17px | 1.62 | 0 | 400, measure 66ch |
| Margin note (Sentient) | 16px / 16px | 1.5 | 0 | 400; label "In plain words" / "En clair" 14px 600 Amber ink |
| Figure caption (Sentient) | 14px | 1.5 | 0 | 400 Graphite |
| Meta / small | 13px | 1.5 | 0.01em | 400 |
| Figures and data (JetBrains Mono) | 13-14px; big numbers clamp(40px, 5vw, 64px) in Zodiak with `font-variant-numeric: tabular-nums lining-nums` | 1.4 | 0 | 400/500 |
- Paper section numbers stay as written in the paper ("1. Introduction"): they are content. No other counters.

## 4. Spacing, radius, depth
- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 160.
- Section padding: 128px top / 96px bottom desktop; 80 / 64 mobile. Paragraph gap 24px. Figure margin 48px above and below.
- Grid (>= 1280px): left TOC rail 120px fixed at left 24px; container max 1200px centred: text column 680px, gap 64px, margin column 336px. 1024-1279: no rail (TOC becomes header menu), text 640 + margin 300. < 1024: one column, margin notes become inline aside cards after their paragraph; page gutter 20px (mobile) / 32px (tablet).
- Wide figures break out to 1048px (text + gap + margin).
- Radius: controls 8, cards and figures 12, notification cards 16, phone body 44 (screen 34).
- Depth (light): cards `0 1px 2px rgba(23,24,28,.05), 0 8px 24px rgba(23,24,28,.06)` plus 1px Rule border. Hover lift on interactive cards: `0 12px 32px rgba(23,24,28,.10)`, translateY(-2px). Phone in band: `0 32px 80px rgba(0,0,0,.5)`, frame #26272B with 1px #3A3B40 inner edge. No glass except the sticky header (Newsprint at 86 percent + 12px backdrop blur, 1px Rule bottom border, only after scrolling 24px).

## 5. Layout, section by section
1. **Header** (sticky, 64px): left wordmark "Adetayo Agueh" (Zodiak 500 18px) + "Research" (Sentient 400 Graphite); right: EN/FR switch, then "Start reading" text link on mobile. 1) wordmark 2) language 3) nothing else.
2. **Hero** (min-height 92svh, Newsprint + Animated Grid): 7/5 split. Left: plain-word eyebrow "Working paper, October 2026"; display headline; 2-line deck (Sentient 21px Graphite); "Start reading" ink button (48px tall, 24px side padding) + secondary text link "Jump to the results". Right: hero figure (a Paper card 1:1 with a price line, the push, the snap-back, then one ntfy card sliding down over the card's top edge). Bottom of hero: 4-number strip (Count Up): "155,954 minutes of real data", "20 stocks", "4.9 alerts per stock per day", "28 percent market-wide". Z pattern. Mobile: headline, deck, button, then the figure at full width, then 2x2 numbers.
3. **Abstract** (Paper card on Newsprint, 880px, padding 48px): paper title, author, the abstract verbatim, plus a 3-bullet "The short version" margin box. F pattern.
4. **1. Introduction / 2. How HFT makes money** (article + margin): margin notes per key term (HFT, index option expiry, bid-ask spread, basis point, latency arbitrage). Figures: Fig 1 "One expiry day" (Bank Nifty pushed up before noon, down after 11:49, option payoff overlay); Fig 2 "Market making" (bid $100.00 / offer $100.05, the 5-cent gap fills); Fig 3 "The latency race" (two orders race to a stale quote; a counter: about one race per minute per stock, 0.5 basis points).
5. **3. Five manipulative strategies** (Pulp ground, full bleed): intro text in the column, then a 5-card specimen grid (3 + 2 on desktop, 1 column mobile). Each card: name, one-line plain explanation, a looping mini-animation that plays on hover/focus or when centred on mobile (static frame otherwise), the evidence type ("Conviction", "Settled", "Pending allegation", "Pattern in data"), and a verdict stamp: "Visible in one-minute data" (Held green) or "Too fast for one-minute data" (Graphite). The paper's subsection text follows the grid in the article column, each subsection linked from its card ("Read 3.1").
6. **4. Who pays** (article + wide figure): Fig 5 bars $3.49 vs $1.92 per contract (82 percent more), plus a "what 0.5 basis points means" calculator line ("5 cents on a $1,000 trade") and the 0.07-0.46 percent round-trip range. Highlighter on the numbers in text.
7. **5. How manipulation is detected today**: Fig 6 timeline (trading date to charge date: Athena 2009 to 2014, Coscia 2011 to 2015, Jane Street 2023-25 to 2025 interim, no final ruling by Oct 2026; CAT approved 2016, rescission draft expected late 2027), scroll-linked line fill. Fig 7 Isolation Forest (interactive): a 2D scatter of minutes (volume z vs move), "Cut again" button; random cuts animate; the outlier isolates in about 3 cuts, a normal point needs 8+; the split counts are shown.
8. **6. Methods and results**: method text with Fig 8 "Three numbers per minute" (volume z-score, reversion, imbalance, each a mini bar diagram) and Fig 9 the score formula as a stacked bar (0.6 model + 0.4 rules) with the Elevated 50 / High 70 lines. Then **the band** (Night desk, full bleed): paper paragraphs on live replay and results in band text, phone pinned in the margin column (desktop) or docked at the top of the band (mobile, 52svh tall crop showing the newest 3 cards). Under the phone: three live tallies (early warnings, cleared, confirmed). After the band: Fig 10 market-wide grid (20 tickers, 8 Oct 12:17, 9 light up in the same minute); Fig 11 the alert dial; Fig 12 controls bars (real 4.9, shuffled 4.9, 10-minute blocks 4.8, calm large caps 5.0); Fig 13 market-wide share (28 vs 7 vs 14-16 percent); Fig 14 planted events recall (78 / 69 / 62); Fig 15 "1,000 alerts" dot grid (10 amber if 1 in 100 were real; toggle to 1 in 10 shows 100).
9. **7. Conclusion**: Zodiak pull quote (Text Reveal on scroll, once): "At best it could tell a retail investor, a few minutes after a sharp move, that the move may have been artificial." Then the paper text.
10. **Works cited**: two-column list on desktop (Sentient 15px), each entry with an anchor id so citation chips can link to it.
11. **Footer**: author, "Data: Yahoo Finance one-minute bars, 21 Sept to 16 Oct 2026. Code and raw bars available from the author.", language switch, back to top.

## 6. Components (21st.dev)
### Sweep log (scout, 2026-11-04: 17 searches, 9 categories)
| Category | Queries | Candidates (id) | Pick | Why |
|---|---|---|---|---|
| Backgrounds | subtle grid background light; dot matrix animated background | 7588, 29376, 39529, 1485, 27200, 5472, 30424, 24194 | 29376 Animated Grid | CSS only, slow drift, radial fade, reduced-motion built in: reads as graph paper |
| Animated (notifications) | phone mockup notifications stacking animation | 39534, 20020, 43164, 28245, 35703, 31788 | 43164 Notification Stack Card | drop-in-and-compress matches how a phone piles ntfy alerts |
| Numbers | animated number counter | 1844, 2470, 20068, 20071, 20060, 7263 | 20068 Count Up | springs on enter, decimals and separators |
| Text animation | text reveal on scroll; highlighter marker text underline animation | 19257, 9386, 23571, 856, 19260, 1881, 18772, 27942, 28151 | 18772 Text Highlighter (+ 19257 Text Reveal Mask for the pull quote) | marker sweep fits print |
| Navigation | scroll progress table of contents sidebar | 34516, 18123, 22596, 18715, 33300, 19205 | 22596 Table of Content | ticks with previews, scrubbable, keyboard |
| Interactive | footnote citation hover card tooltip; language toggle switch segmented; range slider interactive threshold | 25221, 23585, 28253, 221, 3602, 34763, 34935, 23552, 39136, 925, 34775 | 23585 Inline Citations; 39136 Language Switcher Pill | citations are the paper's spine; accessible radio-group switch |
| Scroll | sticky scroll storytelling section | 18041, 12461, 6265, 7970 | none (phone band is custom) | the phone band needs exact scrub control |
| Data viz | animated line chart draw; candlestick price chart | 37467, 39296, 4632, 29358, 24687, 29283 | none (figures hand-built in SVG) | figures must show the paper's exact numbers |
| Showcase / templates | stock ticker marquee; editorial article template | 19171, 27531, 18221 | none | a marquee would add noise to a reading page |

### Adopted
| Use | Component | id / URL | Motion layer | Restyle |
|---|---|---|---|---|
| Hero ground | Animated Grid (rmahammad) | 29376 https://21st.dev/@rmahammad/components/animated-grid | ambient | lines #D8D2C4 at 70 percent, 24px minor / 96px major, drift 1 cell per 40s, radial mask fading to Newsprint at 70 percent radius, remove the glow accent, pause offscreen |
| Phone feed | Notification Stack Card (shadcnspace) | 43164 https://21st.dev/@shadcnspace/components/card-26 | signature | Android ntfy look: white 96 percent cards on the phone wallpaper (#1C1D21 with a faint amber radial), radius 16, app row "ntfy · <topic>" 12px, title 14px 600, body 13px; ntfy tag emoji before the title exactly as ntfy renders tags (the user asked for the notifications as the model sends them); urgent cards get a 3px #C92A2A left edge, quiet ones render collapsed and grey; older cards compress into a stack after 5 with "+N" count; drive it from scroll progress, not timers; remove swipe-to-dismiss and the clear-all button |
| Key numbers | Text Highlighter (danielpetho) | 18772 https://21st.dev/@danielpetho/components/text-highlighter | scroll | Amber at 22 percent alpha, 0.9em tall, left to right 700ms, once, on at most 14 numbers site-wide |
| Citations | Inline Citations (kvnkld) | 23585 https://21st.dev/@kvnkld/components/inline-citations | interaction | keep the paper's author-year text (no numbered chips): dotted 1px Graphite underline; hover/focus/tap opens a 360px Paper card with the full Works Cited entry and a link; Esc closes; touch: tap toggles |
| TOC rail | Table of Content (zanwei) | 22596 https://21st.dev/@zanwei/components/table-of-content | interaction | ticks in Rule, active tick 24px Alert amber, hover magnifies and shows the section title in a Paper label; under 1280px becomes a header "Sections" menu |
| Stats | Count Up (unlumen) | 20068 https://21st.dev/@unlumen/components/count-up | scroll | Zodiak tabular figures, 900ms, once, no blur effect, separators per locale (155,954 / 155 954) |
| EN / FR | Language Switcher Pill (mohitsapat) | 39136 https://21st.dev/@mohitsapat/components/language-switcher-pill | interaction | radius 8 (not a pill), 32px tall, Ink thumb with Newsprint text, no flags; switching navigates to the same section in the other language |
| Pull quote | Text Reveal Mask (soralabs) | 19257 https://21st.dev/@soralabs/components/text-reveal-mask | scroll | line by line, 600ms, once; Zodiak |

## 7. Motion
- Easing: `cubic-bezier(0.16, 1, 0.3, 1)` everywhere. Durations: 160ms feedback, 200ms menus, 400ms entrances, 700ms one-time reveals, 1600ms hero sequence total.
- Signature moment: the Section 6 phone band (pinned, scroll-scrubbed, reversible), 09:50 to 16:00 mapped onto the band's scroll length (about 5 viewport heights desktop, 6 mobile).
- Hero sequence (once on load): grid fades in 400ms; price line draws 900ms; the push segment turns amber; snap-back 300ms; notification card drops 400ms with a 2px overshoot. Total under 1.8s.
- Scroll device per section (no two adjacent alike): hero = signature sequence; abstract = count up; 1-2 = figure line-draws; 3 = staggered card reveal + per-card mini loops; 4 = bars grow + highlighter; 5 = scroll-linked timeline fill; 6 method = diagram build; band = pinned phone scrub; results = grid flash + bars; 7 = text reveal mask.
- Interaction pieces: citation cards, TOC rail, alert dial, Isolation Forest "Cut again", 1-in-100 / 1-in-10 toggle, strategy cards (hover plays the loop), language switch.
- Ambient: only the hero grid. Pauses when the hero leaves the viewport.
- Hover/press/focus: buttons darken 6 percent on hover, scale 0.98 pressed; text links underline from left 200ms; cards lift 2px; focus ring 2px Ink (band: #ECE8DF) offset 2px on everything focusable.
- Reduced motion: no drift, no loops, figures render their final frame; the phone shows the feed as a static list that still follows scroll (instant swaps, no drop animation); the hero shows the finished chart with the card in place.

## 8. Imagery
- No photos. Every visual is drawn in code from the paper's numbers: charts, the phone, the strategy animations.
- Hero visual: a stylised one-minute price line with the push-and-reverse shape and one real early-warning notification from the 8 Oct feed.
- OG image: the hero figure on Newsprint with the headline (1200x630), built as a static PNG at build time or hand-exported.
- No people, no logos of firms or exchanges.

## 9. Copy
- Voice: exact, plain, calm. Banned: supercharge, unlock, seamless, revolutionize, game-changer, "the truth about", exclamation marks.
- Hero headline candidates (pick 1): "Can a retail investor see machine-speed manipulation coming?" (chosen) / "What free minute data can and cannot show about HFT manipulation" / "Five alerts a day, and what they really mean".
- Deck: "A review of how high-frequency manipulation works and who pays for it, and a test of a simple warning tool on 20 real stocks. Read the full paper, with notes in plain words."
- Paper title (placeholder, the manuscript has none): "Footprints at Machine Speed: HFT Manipulation, Retail Investors, and What Free Minute Data Can Show".
- Paper text: verbatim in English; French is a faithful translation labelled "Traduction de l'auteur" (placeholder until the author approves it). Works cited are not translated.
- Plain-language notes say what a term means and why it matters here; they never add claims the paper does not make.
- Claims that need the owner's confirmation: the paper title; "Working paper, October 2026"; the French translation; the footer line about code availability.

## 10. Acceptance criteria
1. The full paper text (abstract, sections 1-7, works cited) appears verbatim in English at `/`, and in French at `/fr/`.
2. The phone band replays the 8 Oct feed generated by `site/scripts/build_phone_feed.py` from the watcher's own `build_message`; titles, bodies, priorities and tags match the JSON exactly; scrolling up rewinds.
3. Only the primary button, language thumb and focus rings use Ink as an action fill; Alert amber never fills a button.
4. Every text/surface pair reaches 4.5:1 (body pairs 7:1), including band text on #111214 and text on the phone cards.
5. Hero headline fits 375px with no overflow; no horizontal scroll at 375, 768, 1024, 1440.
6. At least 4 distinct section treatments, no two adjacent alike (newsprint article, Pulp specimen grid, Night desk band, Paper cards).
7. Every interactive element has default, hover, pressed, disabled (where it applies) and a visible focus state; citations, dial, toggles and TOC work by keyboard.
8. Reduced motion: no drift or loops, all figures show final frames, the phone list still follows scroll.
9. The hero grid pauses offscreen; LCP under 2.5s on desktop; no layout shift from fonts (size-adjusted fallbacks).
10. Numbers on the page match the paper exactly (spot-check 15 numbers).
11. Language switch keeps the reader's section.
