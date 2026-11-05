# Round 4: fixes from round 3 review (87/100, REVISE)

1. Band blocks (PaperPage.tsx): min-h-[40vh] md:min-h-[50vh] -> min-h-[24vh] md:min-h-[30vh]. The 12:17 to 12:25 gap is now one short step.
2. StrategyGrid.tsx: the evidence line moved into the footer stack (mt-auto lifts both); every card has the same 28px verdict element: held-tint chip for "visible", Rule-bordered chip for "too fast". No hole on card 4.
3. Band headline: "8 October" / "8 octobre" joined with a non-breaking space (i18n.ts).
4. Mark.tsx: removed px-[2px], which read as extra word spacing around highlighted figures. Tokens carry no whitespace inside marks.
5. Active replay note: PhoneBand sets data-active on the block that holds the reading line; .band-note gets a 2px Amber-night left edge (globals.css). Inactive notes keep a Night-rule edge.
6. Hero figure label: font-mono 12px Ash -> Sentient 14px Graphite.

Verification: typecheck and build pass. Captures in sections/, sections-fr/, sheet-*.png, desktop-fold-reduced.png.
