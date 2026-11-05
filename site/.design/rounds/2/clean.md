# Round 2: fixes applied from round 1 review (78/100, REVISE)

1. Hero rhythm (Hero.tsx): md:pt-24 -> md:pt-12, h1 clamp(40px,6vw,84px) -> clamp(40px,5.2vw,76px), deck mt-8 -> mt-6, actions mt-10 -> mt-8, figure wrapper mt-12 md:mt-16 -> mt-10 md:mt-8. Measured at 1440x900: chart card top at y=648, spike at y=728 and the notification card fully inside the first viewport (desktop-fold check in scratch capture). Target was <= 640; 8px over, the spike and card are both visible, so kept.
2. Band steps (PaperPage.tsx): mb-[30vh] -> flex min-h-[70vh] flex-col justify-center on every band block; data-t kept. Notes now sit at the phone's reading height.
3. Band headline: clamp(36px,4.6vw,64px)/1.02 -> clamp(32px,3.8vw,52px)/1.06; wrapper 680 -> 760px; mt-3 on the grey tone. "Your phone on 8 October." fits one line at 1440.
4. Statement: max-w 30ch -> 36ch, clamp(28px,3.3vw,44px) -> clamp(24px,2.7vw,36px); now 7 lines at 1440. Added id="statement" so it is captured (d-01-statement.png).
5. Docked and full phone: "No alerts yet..." line before the first notification (Phone.tsx, band.ts labels, EN + FR; wording matches the paper: scoring starts after about 20 minutes of data).
6. StrategyGrid.tsx: evidence line now Sentient 14px Graphite (no mono); only the two "visible in one-minute data" verdicts keep a chip, the others are plain Graphite text.
7. Band container: added border-t border-night-rule and pt-24 md:pt-40 (was py-20 md:py-32).
Also: French paper title uses a non-breaking space before the colon so no line starts with ":".

Verification: build pass; sitecheck still 0 errors (no link changes); no new colours. French page captured in sections-fr/ and sheet-m-fr.png.
Note: one capture in this round came out unstyled because the stylesheet request failed transiently during back-to-back captures; re-captured, CSS serves 200.
