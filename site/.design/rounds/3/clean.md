# Round 3: fixes from round 2 review (83/100, REVISE) and the React code review

## Design fixes (round 2 review)
1. Band blocks (PaperPage.tsx): min-h-[70vh] -> min-h-[40vh] md:min-h-[50vh].
2. Band headline moved inside PhoneBand as the text column's first child, so the phone column starts level with it (PaperPage.tsx, PhoneBand.tsx). On narrow screens the docked phone now comes after the headline (Children.toArray split in PhoneBand).
3. Statement: mx-auto removed; left edge now on the page's content edge.
4. Strategy card footer: flex-col items-start gap-2.
5. Band paragraphs: max-w 620px, 18px from md.
6. NOT applied: sentence-case section headings. They are the author's paper titles, kept verbatim (the brief says the paper text is verbatim).
7. #f08a5d is now the token --color-amber-night (text-amber-night), recorded in design-system.md.
8. Hero figure wrapper md:mt-8 -> md:mt-6.

## Code review fixes (react-reviewer, Sonnet)
- IForestFigure: could crash when "Cut again" produced fewer cuts than were shown; now clamps, resets on click, starts on click even before the figure scrolled into view, guards the cut loop, uses aria-pressed toggles, and announces only the final count.
- Cite: placement in useLayoutEffect (no flash at the old position), rAF-throttled scroll, click pins a hover-opened card, hover timer cleared on click and unmount, closes when focus leaves, no dialog role, Enter/Space ignore key repeat.
- LanguageSwitch: real links with hreflang and aria-current instead of a radio group that navigated on arrow keys.
- Phone: AnimatePresence popLayout parent is now positioned (exiting cards no longer jump).
- PhoneBand: ResizeObserver re-measures anchors on layout shifts; phone wrappers are named regions.
- tokenize: all occurrences scanned, longer names claim first, each citation key must match exactly one Works Cited entry (build fails otherwise), URL regex bounded and trailing punctuation stripped.
- results.tsx: the 14-16 percent row uses a range field, not label text.
- Header and TocRail scroll handlers rAF-throttled.

## Verification
- Typecheck and build pass; static export of / and /fr/.
- In the browser at 1440: no runtime errors after switching targets and pressing "Cut again" repeatedly; ordinary minute isolated after 14 cuts; citation opens, positions, and closes on outside press; language links /, /fr/ with aria-current.
- Captures: sections/, sections-fr/, sheet-d.png, sheet-m.png, sheet-m-fr.png, sheet-d-fr.png, desktop-fold-reduced.png.
