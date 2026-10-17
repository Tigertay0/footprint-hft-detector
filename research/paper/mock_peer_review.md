# Mock peer review: editorial decision

Manuscript: "HFT Research Paper - Edited (your text, corrections only)", by Adetayo Agueh
Review date: 17 October 2026
Mode: full review, five seats (Journal-Fit Reviewer, Reviewers 1 to 3, Devil's Advocate), then this editorial synthesis. No target venue was confirmed, so fit comments are field-general.

## Decision: Major Revision

All four scoring reviewers and the Devil's Advocate recommend Major Revision, each with medium confidence. Nobody recommends rejection. The reviews say the literature review is careful and the empirical section is honest about what it cannot show, but the abstract and conclusion promise more than the evidence supports.

## What blocks acceptance (3 issues)

| # | Blocking issue | Raised by | Where |
|---|---|---|---|
| B1 | The abstract and conclusion call the detector "a realistic design for a warning tool" that can warn a retail investor "before they trade". Section 6 shows about five alerts per stock per day, no measure of whether any alert is manipulation, 91 percent of early warnings cleared, and a reversal signal that needs five minutes of later prices. | Journal-Fit, Reviewer 1, Reviewer 3, Devil's Advocate | Abstract, Section 7 |
| B2 | The claim that small traders "pay more" for manipulation rests on one figure: what aggressive HFTs earned per futures contract in one month of 2010. That measures HFT profit in index futures, not losses from manipulation, and not equity retail investors. | Journal-Fit, Reviewer 2, Devil's Advocate | Sections 4 and 7 |
| B3 | Section 6 cannot tell signal from noise. There is no test that the detector finds a real push-and-reverse, no comparison with shuffled data, and no check of how the results change when its own settings change. | Reviewer 1, Devil's Advocate | Section 6 |

## Reviewer summary

| Reviewer | Angle | Recommendation | Confidence |
|---|---|---|---|
| Journal-Fit Reviewer | originality, fit, clarity | Major Revision | medium |
| Reviewer 1 | methodology | Major Revision | medium |
| Reviewer 2 | market-manipulation domain | Major Revision | medium |
| Reviewer 3 | investor protection and policy | Major Revision | medium |
| Devil's Advocate | strongest case against | Major Revision (findings only) | medium |

## Where the reviewers agree

Four of four non-adversarial reviewers, plus the Devil's Advocate:
- **Honest limits are the paper's best feature.** Reporting that precision cannot be measured, that 28 percent of alerts are market-wide, and that the Jane Street order is interim and disputed was praised by every seat.
- **The harm evidence is indirect.** Baron et al. measure aggressive HFT profit in futures. Severity ranged from Minor (Reviewer 3) to CRITICAL (Devil's Advocate).
- **"A small share of their activity crosses into manipulation" has no source.** Flagged by all four. A one-line fix is to cite an estimate or soften the wording.
- **The SEBI 93 percent loss figure sits next to the Jane Street case with no link shown.** SEBI does not attribute those losses to manipulation.

Three of four (Reviewer 2 silent):
- **The conclusion goes beyond Section 6.** Journal-Fit, Reviewer 1, and Reviewer 3 each say the "realistic design" and "before they trade" language should become a feasibility result.

## Where they disagree, and how I resolved it

**Is the market-wide filter a strength or a weakness?** The Journal-Fit Reviewer calls it a simple, explainable idea. Reviewer 1 and the Devil's Advocate say it is confounded, because SPY, QQQ, TQQQ, SQQQ, SOXL and six mega-cap tech names share one factor, and it has no baseline for chance. Resolution: keep it, but present it as a promising filter that is not yet validated, and run a shifted-time null test before relying on the 0.4 alerts per stock per day figure.

**How severe is the harm-evidence problem?** The Devil's Advocate marks it CRITICAL; the Journal-Fit Reviewer and Reviewer 2 mark it Major. Resolution: Major. It is fixable by rewording and by adding the counter-evidence Reviewer 2 names, so it does not sink the paper.

## Devil's Advocate CRITICAL issues, adjudicated

- **C1, the harm conclusion has no direct support.** Validated. Reviewer 2 and the Journal-Fit Reviewer independently reached the same finding. It stays on the blocking list as B2.
- **C2, "realistic design" contradicts the paper's own results.** Validated. Reviewers 1 and 3 and the Journal-Fit Reviewer agree. It is B1.

Neither was dismissed.

## One error in my own edits, now fixed

Reviewer 2 caught a mistake I introduced when editing: I wrote that the Aquilina cost estimate (0.5 basis points) was "much lower" than the futures figure. But $3.49 on a contract worth about $50,000 is roughly 0.7 basis points, so the two are about the same size. I corrected that sentence in your doc.

## Why Major Revision and not something else

The paper is not publishable as a claim that the detector works, and every reviewer who read Section 6 says so. It is also not a reject: the review of the literature is sourced, legally careful, and readable, the test uses real data and is reproducible, and the negative result is stated plainly. Reviewer 1 says every fix needs only free data, and Reviewer 3 says most of the others need rewriting. A reframed paper, "an exploratory test of a candidate design, with a literature review", would likely draw Minor Revision from the same panel.

## Required revisions

"Wording" means rewriting sentences. "Analysis" means new code runs, which I can do on your saved data.

| # | Revision | From | Effort |
|---|---|---|---|
| R1 | Reframe the abstract and conclusion as an exploratory test of a candidate design. Drop "realistic design" and "before they trade". State that the cost of manipulation to retail investors is not measured here, and that Baron's "small traders" are futures accounts. | B1, B2 | Wording |
| R2 | Add controls to Section 6: (a) plant synthetic push-and-reverse events and report how many the detector finds; (b) rerun on block-shuffled returns; (c) shift each ticker's alert times by a random offset and recompute the market-wide share; (d) a table showing results at other contamination (0.5, 1, 2 percent) and percentile-gate (90, 95, 99) settings. | B3 | Analysis |
| R3 | Lead with the live-replay numbers, since the filtered 0.4 per day figure uses five minutes of future prices and cannot be produced live. | Reviewers 1 and 3 | Wording |
| R4 | Compare rules only, forest only, and the combined score, and justify the 0.6 and 0.4 weights. | Reviewer 1, Devil's Advocate | Analysis |
| R5 | Label each of the five strategies by evidence tier: adjudicated (Coscia), settled (Athena), pending allegation (Jane Street), data pattern (momentum ignition, quote stuffing). Place all five on one timescale, including marking the close. Revise "at least five forms". | Reviewer 2, Journal-Fit | Wording |
| R6 | Add the missing counter-evidence and balance Section 4: Malinova, Park, and Riordan by name; Aitken, Cumming, and Zhan (2015); Comerton-Forde and Putniņš (2011); Kyle and Viswanathan (2008). Soften "the two bodies of evidence are compatible". | Reviewer 2 | New sources |
| R7 | Add a worked base-rate example in natural frequencies ("of 10,000 alerts, about N are real") and a short "risks of use" paragraph. Rename the "HFT risk score" to "unusual activity score" and add user text saying a flag is not evidence of manipulation. | Reviewer 3 | Wording |
| R8 | State in one sentence what the paper adds beyond SEC Staff (2014), Putniņš (2020), Núñez Delafuente et al., and Chen and Hybinette. Add a table of the five strategies (data needed, whether minute bars are enough, why). Add a funnel table: 788, 221, 122, 64. Cut the abstract below 250 words. | Journal-Fit | Layout |
| R9 | Check a sample of the 64 stock-specific reversals against news and earnings dates. Add some thinly traded or randomly chosen stocks, and bootstrap by trading day. | Reviewers 1 and Devil's Advocate | Analysis |
| R10 | Source or soften "a small share of their activity crosses into manipulation", and separate the SEBI 93 percent statistic from the Jane Street case. | all four | Wording |
| R11 | Add a short paragraph on how sources were chosen, a parameter table, and the random seed and library versions. | Reviewer 1 | Wording |

Do R1, R5, R6, R10, and R3 first. They take wording and sources only, and they remove two of the three blockers' worst effects before any new analysis.

## Optional

- Deposit the code on Zenodo or OSF for a citable link, and do not post the raw Yahoo files (Reviewers 1 and Journal-Fit).
- Choose a title that signals "literature review with an exploratory test"; the supplied text has none.
- Shorten the latency-arbitrage and wholesaler-pricing passages, which are about execution cost, not manipulation.
- Reviewer 1 notes that 16 October 2026 was a monthly options expiry day, which may have affected that session. The reviewer did not confirm the exchange calendar, so check it.

## Panel provenance and limits

- Role-separated: yes, five separate invocations, each given its own role file.
- Blind to peer reports: yes, none could see another's output.
- Model family distinct: no. All five seats ran on the same AI model, so their errors may be correlated.
- Provider distinct: no. Human reviewer distinct: no, there were no human reviewers.
- This is a simulated panel and is not calibrated. It can find weak points before a real submission. It cannot replace a real editor or reviewers, and its judgments are not predictions of what one would decide.
- Several reviewer leads are unverified and should be checked before use: the Malinova et al. and Aitken et al. findings were read from abstracts only, and Reviewer 1's roughly 14 percent chance level for the market-wide filter is a rough calculation, not a measured value.

---

# Appendix: full report (R_eic.md)

## Journal-Fit Review Report

Reviewer identity: associate editor, quantitative-finance and market-structure outlet for retail investors, students and early-career researchers.
Venue criteria: criteria_binding_unavailable (observations are field-general).
Calibration Status: NOT_CALIBRATED
Overall Recommendation: Major Revision (rewriting and one table, no new data)
Confidence Score: 3

### Summary Assessment
The paper reviews research on HFT manipulation, argues that only some strategies show up in free minute-level data, and tests an Isolation Forest plus rules detector on 20 tickers over 20 sessions. It is readable, well sourced and frank about the test's limits. The main weakness is the gap between promise and delivery. The "so what" is a warning tool for retail investors, yet the test yields about five alerts per stock per day, no measure of whether any alert was manipulation, and mostly cleared early warnings. The conclusion still calls the design realistic. The cost-to-retail question is answered with evidence about HFT profits in general. The most original idea, what public data can see strategy by strategy, gets one sentence. Rewriting can repair this.

### Criterion-Bound Judgements (source: criteria_binding_unavailable)
- Originality: PARTLY_MEETS. Decision bearing: gain over existing reviews unstated.
- Argument Coherence: PARTLY_MEETS. Decision bearing: both questions only partly answered.
- Significance and Impact: PARTLY_MEETS. Decision bearing: retail "so what" promised, not shown.
- Writing Quality: MEETS. Not decision bearing.
- Methods, literature coverage: NOT_ASSESSED (other seats).

### Strengths
S1. A real gap, clearly stated: regulator tools do not serve retail users. Anchor: text: Section 1, "has nothing that tells them whether its price is being pushed".
S2. Honest reporting of unflattering results and limits. Anchor: text: Section 6, "answer the paper's second question only in part".
S3. A simple, explainable idea: check whether other tickers alerted at the same moment. Anchor: text: Section 6, "more likely to be news or a market-wide trade than manipulation of one stock".

### Weaknesses
W1. The headline "so what" is not supported by the test.
Section 7 says the tool could tell a buyer the price "may be artificial". Section 6 shows only 15 percent of 788 episodes with a reversal, and 91 percent of live early warnings cleared. A warning cleared nine times in ten, with no measured hit rate, does not yet help a buyer, and no alert is shown as a user would see it. Fix: reword the Abstract and Conclusion as an exploratory test of a candidate design, say decision value is untested, and show one stock-specific and one market-wide example alert.
Severity: Major | Anchor: text: Section 7, "is a realistic design for a warning tool" | Confidence: 4, claims versus evidence, core field.

W2. The cited evidence does not measure what retail traders pay for manipulation.
The only per-trader figures (Baron et al., $3.49 versus $1.92) are aggressive HFT profits in 2010 index futures, not manipulation, and futures "small traders" are not retail stock buyers. Fix: state that no cited study isolates the cost of manipulation to retail investors, present Baron as an indirect proxy for HFT cost, and remove "for it" from the Conclusion.
Severity: Major | Anchor: text: Section 7, "small, active traders pay more for it than large traders do" | Confidence: 4, core field.

W3. Originality and the central mapping are asserted, not argued, and only half tested.
No paragraph says what the paper adds to SEC Staff (2014), Putniņš (2020), or Núñez Delafuente et al. and Chen and Hybinette, who ran Isolation Forests on hourly and minute data with labels. Marking the close, trades in the "final seconds", drops out without comment. Section 6 tests only momentum ignition, and Section 5.4 reports that about three of four flagged Bank Nifty days had no known manipulation, which cuts against the expiry-day claim. Fix: add a table of the five strategies (data needed, whether minute bars suffice, why) and a one-sentence statement of the gain, such as the detectability mapping or the market-wide filter.
Severity: Major | Anchor: text: Abstract, "operate on a timescale that public minute-level data can capture" | Confidence: 4, core field.

W4. Reader-facing clarity.
There is no table or figure. The key result, a funnel of 788 episodes, 221 market-wide, 122 with reversal and 64 stock-specific reversals, is spread over four paragraphs. The abstract runs about 290 words. Fix: add a funnel table and cut the abstract below 250.
Severity: Minor | Anchor: absence: Sections 1 to 7, expected a table or figure; checked all section text and Works Cited | Confidence: 4, editorial experience.

### Questions for Authors
1. In one sentence, what does this paper add that SEC Staff (2014) and Putniņš (2020) do not?
2. Which Section 6 result would have shown the tool does not work, and did you decide that beforehand?
3. Why does marking the close fall out of the detectable set?

### Minor Issues
- No title appears in the text supplied. Choose one that signals a literature review with an exploratory test.
- Abstract: "a small share of their activity crosses into manipulation" has no cited estimate.
- Section 1 places "93 percent of individual traders in Indian equity derivatives lost money" beside Jane Street with no link. Say those losses are not attributed to manipulation.
- Section 2 latency arbitrage and the Section 4 wholesaler paragraph concern execution cost, not manipulation. Shorten.
- Deposit code and data on Zenodo or OSF with a DOI.

Recommendation signal: Major Revision. Confidence: medium.

---

# Appendix: full report (R_methodology.md)

## Methodology Review Report (Peer Reviewer 1)

Reviewer: applied ML researcher, unlabeled anomaly detection in financial series (blind spot: domain context).
Calibration status: NOT_CALIBRATED
criteria_binding_unavailable
Recommendation: Major Revision. Confidence score: 4 of 5.

### Summary assessment
The paper pairs a literature review with a small real-data test of an Isolation Forest plus three rules on 20 tickers and 20 sessions. It is honest that, without labels, the test describes alert burden and not detection skill. But the numbers cannot yet be interpreted. There is no positive control, no chance baseline and no sensitivity to the author's own thresholds, so the headline results may mostly restate the settings. Some claims in the abstract and Section 7 go past what Section 6 tested. All fixes below use free data. Field-general judgements: Methodological Rigor, Evidence Sufficiency and Argument Coherence all PARTLY_MEETS.

### Strengths
S1. Honest scoping. Section 6: "without labels they remain candidates, not confirmed cases". Precision and recall are withheld, not invented.
S2. Time-ordered split and causal design. Section 6: "so it never saw the period it was judged on". The author also spotted the five-minute look-ahead and built a replay mode.

### Weaknesses

W1. No positive control and no chance baseline
Major | Anchor: Section 6, "No artificial events were added to the data." | Confidence 4
Nothing shows the detector finds a push-and-reverse when one exists, or how many it "finds" in data with none, so the 64 stock-specific reversal episodes cannot be read as signal or noise. Fix: inject synthetic pump-and-reverse events of several sizes into the test bars and report recall. Also shuffle minute returns in blocks within each ticker-day and rerun. If shuffled data give about 0.4 per stock per day, the finding is noise.

W2. Alert rate is set by unjustified thresholds
Major | Anchor: Section 6, "at its default setting it alerts about five times per stock per day" | Confidence 4
Contamination, the 95th percentile gate, rule cutoffs, the 0.6 and 0.4 weights and the 50 and 70 cutoffs are untested. Contamination only moves the predict line while the score uses a separate gate, so it is unclear which drives the rate. Fix: a sensitivity table (contamination 0.5, 1, 2 percent; gate 90, 95, 99).

W3. The filtered rate cannot be produced live
Major | Anchor: Section 7, "tell a retail investor, before they trade" | Confidence 4
The reversal filter needs "five minutes of future prices" and the market-wide test looks two minutes ahead, so the 0.4 figure is retrospective. Only the live replay (20 stock-specific confirmations) reflects what a user could get, after the push is over. Fix: lead with live-mode numbers and reword Section 7.

W4. Market-wide filter is confounded and has no null
Major | Anchor: Section 6, "at least three of the other 19 tickers also had an alert episode" | Confidence 4
SPY, QQQ, TQQQ, SQQQ, SOXL and six mega-cap tech names share one common factor, so one index move can trip the rule alone. A rough calculation spreading the 788 episodes evenly gives about 14 percent labelled market-wide by coincidence, against 28 percent observed. Alerts cluster, so true chance is higher. Fix: shift each ticker's alert times by a random offset and recompute.

W5. Sample design limits every conclusion
Major | Anchor: Section 6, "I chose 20 tickers for heavy trading and sharp price moves" | Confidence 4
Volatile tickers are the likeliest to trip a volatility detector, with no comparison group. Features are scaled to each ticker's own history, so "The rate was similar across all 20 tickers" is expected by construction. Alerts cluster in time, so 788 episodes are far fewer independent observations, and no interval is given. By my count 16 October is monthly options expiry. Fix: add 20 random S&P 500 names, bootstrap by day, and lengthen the history with a free source of older minute data (for example Alpaca's free tier).

W6. Claims beyond what Section 6 tested
Major | Anchor: Abstract, "Isolation Forest is the most realistic starting point" | Confidence 4
No rules-only or other-model comparison exists, yet Section 5.4 reports an autoencoder flagging 10 of 10 days against the forest's 8. The abstract also says minute data "can capture" expiry-day manipulation, never tested here, and "a small share of their activity crosses into manipulation" has no source. Fix: run the ablations and reword these claims as untested.

W7. No stated literature search method
Minor | Anchor: absence in Sections 1 to 7 and Works Cited of databases, keywords, years or inclusion rules | Confidence 3
Source choice seems driven by free access: market-making mechanics cite a vendor education page, and the lead harm figure is gross profit from one contract in one month, from a 2012 working paper. Fix: a short method paragraph and a source-type table.

W8. Not reproducible from the paper alone
Minor | Anchor: Section 6, "both are available from the author." | Confidence 4
Unstated: pooled or per-ticker forest; the reversion value on minutes with no sharp move; how a one-hour baseline fits a 20-minute warm-up; missing bars (155,954 versus 156,000); seed and library version. Fix: a parameter table and a public repository (check Yahoo's terms).

### Questions for authors
1. Was any setting changed after you saw the test results?

Recommendation signal: Major Revision. Confidence: medium (code unseen; domain context may soften some points).

---

# Appendix: full report (R_domain.md)

# Domain Review (Peer Reviewer 2)

Identity: market microstructure and manipulation scholar.
Venue fit: criteria_binding_unavailable
Calibration status: NOT_CALIBRATED

## Summary
The paper reviews five manipulation strategies, weighs retail harm against HFT benefits, and tests a detector on one month of minute data. The domain problems lie in how evidence is classed: allegations, statistical patterns and settled orders are sorted together as "five forms" of manipulation, the harm evidence measures aggressive HFT profit rather than manipulation losses, and key retail counter-evidence is missing. These are rewriting and sourcing repairs.

## Strengths
S1. Legal hedging on Jane Street, plus disclosure that the E-mini figure is absent from the published Baron et al. paper.
Evidence Anchor: text: Section 1 "Jane Street disputes the allegations, and the order is interim"

S2. Candid reporting of weak precision in prior detection work.
Evidence Anchor: text: Section 5.4 "only 2 to 6 percent of the hours they flagged were actually manipulated"

## Weaknesses

### W1. Allegations and patterns presented as established strategies
The fifth category rests on one interim, contested order and a blog. Momentum ignition rests on a Credit Suisse practitioner note that defines a detectable pattern, not adjudicated conduct. Quote stuffing cites no enforcement action. The Patel case involved no HFT firm and mixes ignition with order cancellation. Section 1 says "Athena's manipulation took place in 2009", though that order was settled without admission. Fix: label each strategy by evidence tier (adjudicated: Coscia; settled: Athena; pending allegation: Jane Street; data pattern: ignition, stuffing) and rewrite the abstract and conclusion to match.
Severity: Major
Evidence Anchor: text: Section 7 "HFT manipulation takes at least five forms, from momentum ignition to expiry-day index manipulation"
Confidence: 4, core field

### W2. Taxonomy mixes axes and drifts from HFT
The categories differ by tactic, timing and venue, and overlap. The alleged Jane Street scheme runs for hours with profit in options, so it is neither speed-dependent nor visible in single-stock minute bars. Section 7 sorts strategies by minute-level visibility but omits marking the close, which Section 3.4 places in the final seconds. Section 1 lists momentum ignition as one of three main HFT groups, whereas the SEC Concept Release the paper cites uses four (passive market making, arbitrage, structural, directional), with ignition under directional. Fix: use the SEC grouping for legal HFT, define the five types on one axis, and classify all five by timescale.
Severity: Major
Evidence Anchor: text: Section 7 "last long enough to appear in free minute-level data"
Confidence: 4, core field

### W3. Harm evidence does not measure what Section 4 claims
The $3.49 and $1.92 figures are aggressive HFT profits against E-mini futures small traders. They are not equity retail losses and include legal short-term prediction. By my arithmetic, $3.49 on a contract worth about $55,000 (index near 1,100, times $50) is roughly 0.6 basis points, the same order as the 0.5 basis points later called "much lower". Please check. The buy-and-hold claim rests on a CRS report citing an unnamed Canadian study, which should be named. Fix: report basis points, state that no cited study measures manipulation losses, and retitle the section.
Severity: Major
Evidence Anchor: text: Section 4 "Small traders therefore paid about 82 percent more per contract than the larger traders"
Confidence: 4 on scope, 3 on the arithmetic

### W4. Thin benefit side, missing retail counter-evidence
Benefits get two sentences, then the evidence is declared compatible untested. Missing is Malinova, Park and Riordan, a Canadian message-fee experiment where, from the abstract I read, HFT retreat raised institutional costs, left retail market-order costs unchanged and lowered retail returns. It is the most direct retail study and cuts against the thesis. Aitken, Cumming and Zhan (2015) find HFT presence lowers end-of-day price dislocation, relevant to Section 3.4. Fix: add both, say the retail evidence is mixed, and soften the closing claim about the second group.
Severity: Major
Evidence Anchor: text: Section 4 "The two bodies of evidence are compatible"
Confidence: 4, core field

### W5. Weak sources carry foundational claims
Section 1 defines HFT groups from a commercial education site, a Citadel marketing page and a student note. The conclusion leans on two arXiv preprints. Fix: cite Menkveld (2013) and Hasbrouck and Saar (2013), and label preprints.
Severity: Minor
Evidence Anchor: text: Section 1 "HFT strategies fall into three main groups"
Confidence: 4, core field

## Missing references
- Malinova, Park and Riordan, "Do Retail Traders Suffer from High Frequency Traders?" (SSRN 2183806).
- Aitken, Cumming and Zhan, Journal of Banking and Finance 59 (2015).
- Comerton-Forde and Putnins, "Measuring Closing Price Manipulation," Journal of Financial Intermediation 20(2), 2011.
- Kyle and Viswanathan, "How to Define Illegal Price Manipulation," American Economic Review 98(2), 2008.
- [UNVERIFIED] search leads: DOJ spoofing cases against Navinder Sarao and the 2020 JPMorgan metals resolution.

## Questions for authors
1. Which legal activities (news, fund rebalancing, option hedging) produce the same push-and-reverse shape?

## Minor issues
- Abstract: "a small share of their activity crosses into manipulation" has no source.
- Section 1 sets SEBI's 93 percent loss figure beside the Jane Street allegation; SEBI does not blame manipulation.
- Section 3.3: the 74 percent counts intense quoting episodes, not proven manipulation.
- Section 3.2: intent cannot be seen in data, and high cancellation rates are normal for legal market makers; say how courts infer intent.

Recommendation signal: Major Revision
Confidence: medium

---

# Appendix: full report (R_perspective.md)

# Perspective Review (Peer Reviewer 3)

Reviewer identity: investor-protection and fintech-policy scholar with computer-science and behavioral-finance background. I judge practical claims, not econometrics.
Venue fit: criteria_binding_unavailable
Calibration Status: NOT_CALIBRATED

## Summary Assessment

This is a careful student review with an honest results section. It reports about five alerts per stock per day, 91 percent of live early warnings cleared, and no way to measure precision. My concern is the gap between those numbers and the practical claims in the abstract and conclusion. The design is called "realistic" and said to warn a user "before they trade", yet the paper never works out how often an alert would be right or what a wrong alert costs. The fixes are mostly rewriting plus one short calculation. 

## Strengths

S1. Careful legal wording on a live case. Claims stay attributed to SEBI, lowering defamation risk.
Evidence Anchor: text: Section 1, "Jane Street disputes the allegations, and the order is interim"

S2. The user's burden is reported even when unflattering.
Evidence Anchor: text: Section 6, "586 of them (91 percent) were cleared because the move held"

## Weaknesses

### W1: "Before they trade" conflicts with the paper's own timing
The reversal is the only signal that matches momentum ignition, and it needs five minutes of later prices. The one-minute early warning did not become a reversal 91 percent of the time. A user gets a mostly empty warning at once, or a better one after the move. Fix: state this trade-off and replace "before they trade" with what the evidence supports, such as a flag minutes later that a move looked like push-and-reverse.
**Severity**: Major
**Evidence Anchor**: text: Section 7, "before they trade, that the price they are about to chase may be artificial"
**Confidence**: 4, uses the paper's own figures

### W2: No base-rate reasoning, and the prevalence claim is unsourced
The abstract calls manipulation rare without a number or source. When true events are rare, even an accurate detector yields mostly false alarms, as the paper's sources show: 2 to 6 percent of flagged hours were real (Núñez Delafuente et al.), and about three in four flagged days had no known manipulation (Chen and Hybinette). Fix: add a worked example in natural frequencies ("of 10,000 alerts, about N are real") across assumed prevalence, and say prevalence is unknown here.
**Severity**: Major
**Evidence Anchor**: text: Abstract, "a small share of their activity crosses into manipulation"
**Confidence**: 5, core expertise

### W3: No analysis of what users do with an alert
Section 4 says active traders are the exposed group, yet an alert feed invites more watching and trading. As a scale check, one needless round trip costs 7 to 46 basis points (Schwarz et al.), against 0.5 for the measured arms race. The paper also skips chasing or fading a flagged move, alarm fatigue, and manipulators who trigger alerts to push users out. Fix: add a short "Risks of use" subsection with an expected-value comparison and a safest default action (wait, do not chase).
**Severity**: Major
**Evidence Anchor**: text: Section 4, "round-trip costs ranged from 0.07 to 0.46 percent"
**Confidence**: 3, adjacent field, crude cost figures

### W4: The label and per-ticker numbers can be misread
The output is an "HFT risk score" with "High" bands, but the data hold "no trader identities", 85 percent of alerts lacked a reversal, and 28 percent were market-wide. News, index trades, or retail crowds also cause unusual trading. Per-ticker rates (MARA 3.5, NIO 6.8) appear with no warning. Fix: rename it "unusual activity score", add user text such as "Trading was unusual. News often causes this. This is not evidence of manipulation", and say per-ticker rates tell nothing about those companies.
**Severity**: Minor
**Evidence Anchor**: text: Section 6, "The HFT risk score combines the two parts"
**Confidence**: 4, core expertise

### W5: Design claims outrun the test
Isolation Forest alone flagged 0.9 percent of minutes, close to its 1 percent setting, so that rate comes from a parameter, not a finding. No simpler baseline was compared. The market-wide filter would also likely remove the index-wide events the Conclusion says appear in minute data. Fix: write "computable on free data, not yet shown to be useful".
**Severity**: Minor
**Evidence Anchor**: text: Section 7, "is a realistic design for a warning tool"
**Confidence**: 4, uses the paper's own figures

### W6: Comparators, advice question, harm evidence
Limit up-limit down pauses are not compared, so the stated gap is overstated. A public alert service could count as advice; I am not a lawyer, but one sentence is needed. SEBI's 93 percent loss figure sits beside Jane Street with no link shown, and "small traders" in Baron et al. may not mean retail. Fix: add a baseline paragraph; separate the statistic from the case.
**Severity**: Minor
**Evidence Anchor**: text: Section 1, "has nothing that tells them whether its price is being pushed"
**Confidence**: 3, adjacent field

## Reading Leads

Barber and Odean, "Trading Is Hazardous to Your Wealth" (Journal of Finance, 2000). Gigerenzer and Hoffrage (Psychological Review, 1995), on natural frequencies. [UNVERIFIED] lead: clinical alarm fatigue reviews.

## Questions for Authors

1. If the tool shows High at 10:41, what should the user do, and what does a wrong alert cost?
2. What true-event rate would make one alert in ten correct at your alert rate?

Recommendation signal: Major Revision
Confidence: medium

---

# Appendix: full report (R_devils_advocate.md)

criteria_binding_unavailable

# Devil's Advocate Review

Calibration Status: NOT_CALIBRATED

## Strongest Counter-Argument

The paper treats three weak links as a chain. First, its only number on who pays is the profit of aggressive HFTs against small traders in one month of 2010 futures trading. That is the price of trading against fast liquidity takers, mostly legal, and small futures accounts are not equity retail investors. No cited study measures what manipulation costs anyone. Second, minute bars are said to capture momentum ignition because events last 1.5 minutes, but that figure comes from one 2012 broker note on European stocks, and being long enough to see is not the same as being distinguishable from news or hedging. Third, the paper calls Isolation Forest plus rules a realistic design, yet its own test shows about five alerts per stock per day, 85 percent without the defining reversal, no labeled case, and a model alert rate near the preset 1 percent. The 64 filtered episodes were selected by the pattern being sought. The simplest rival reading is that the detector finds volume bursts, and volume bursts are what news looks like. Retail losses are better explained by leverage, trading frequency, and broker execution costs (Schwarz et al. find 0.07 to 0.46 percent per round trip). What survives is a useful literature summary and an honest negative result. The claim that this design is a realistic way to protect retail traders does not.

## Issue List

### CRITICAL

C1. Logic chain, Section 7: "small, active traders pay more for it than large traders do". The only number behind this, from Baron et al., is aggressive HFT profit per futures contract in one month of 2010. It measures neither manipulation nor equities, so the harm conclusion has no direct support. Fix: state that manipulation cost to retail is unmeasured and argued from mechanism only.

C2. Overreach against own results, Section 7: "is a realistic design for a warning tool". With no labels, no alert is shown to be manipulation, and 91 percent of early warnings were cleared. Reversal is confirmed five minutes later, after a 1.5 minute event is over, so the closing promise of a warning "before they trade" fails. Fix: call this a feasibility probe, validate on SEBI's Jane Street dates, and drop the pre-trade claim.

### MAJOR

M1. Overgeneralization, Section 7: "last long enough to appear in free minute-level data". Visibility is treated as detectability. The duration rests on one non-peer-reviewed note, expiry-day cases were never tested, and the paper's own sources show 75 percent false flags and hedging mimics. Fix: limit the claim to momentum ignition as a hypothesis, or test expiry days.

M2. Confirmation bias, Section 6: "the closest match to momentum ignition in this data". The reversal rule defines the pattern, then reversals are called best candidates. The three-tickers-in-two-minutes cutoff is arbitrary, and SPY, QQQ, TQQQ, SQQQ, and SOXL guarantee shared moves. No episode was checked against news. Fix: check a sample of the 64 against news and earnings dates, and report cutoff sensitivity.

M3. Sampling, Section 6: "20 tickers for heavy trading and sharp price moves". The most liquid names are the hardest for one actor to push, and eight sessions in one month cannot support claims about retail tools. Fix: add thinly traded stocks and a scheduled-news control, and scope conclusions to this sample.

M4. Missing baseline, Section 6: "The HFT risk score combines the two parts". Rules fire in 74 and 62 percent of episodes, yet no rules-only, forest-only, or shuffled comparison shows the forest adds anything. Fix: report those comparisons and justify the 0.6/0.4 weights.

### MINOR

m1. Framing, Section 1: "93 percent of individual traders in Indian equity derivatives lost money". Placed beside Jane Street, it implies manipulation as cause, though costs and leverage also explain such losses. Fix: separate them or state the link is unshown.

m2. Weighing, Section 4: "The two bodies of evidence are compatible." Asserted, not netted. Fix: put spread savings and extra active-trader cost on one scale per $1,000 traded.

## Ignored Alternative Explanations

1. News, earnings, ETF rebalancing, and options hedging explain one-sided bursts that hold, with no event-calendar check.
2. Execution quality and trading behavior dominate retail cost, so a broker comparison tool may help more.
3. Batch auctions, which the paper cites, or limit orders address the harm without a detector.

## Missing Stakeholder Perspectives

- Market makers and exchanges (false accusation, real liquidity)
- Regulators (risk of public alerts on named stocks)
- Retail users who may trade on false alerts

## Observations (Non-Defects)

- Reporting that precision is unmeasurable, and the market-wide share, is the strongest contribution.
- The interim, disputed SEBI case is handled carefully.
- Raw data is saved for reproduction.

Recommendation: Major Revision. Confidence: medium.
