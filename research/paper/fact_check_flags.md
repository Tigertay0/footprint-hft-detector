# Fact-check report: "HFT Research Paper - Full Draft (Lit Review)"

Checked 16 October 2026. Every claim was traced to its source: SEC, DOJ, and SEBI documents, court opinions, and the papers themselves. Newer research came from Google Scholar, Crossref, OpenAlex, and arXiv. Every DOI in the updated Works Cited resolves. Method: the Academic Research Skills suite (deep-research fact-check mode and academic-paper citation check).

Result: 33 items flagged. 3 are false, 4 overstate what the evidence shows, 1 is unsupported, 1 is unverifiable, 5 are out of date, and the rest are partly true or have citation problems. The core argument survives. The two conclusions in your abstract about what retail data can and cannot catch need rewording, because 2024-2026 research has tested exactly that.

## High priority: these change a conclusion or state something false

| # | Where | Paper says | Verdict | What is actually true |
|---|---|---|---|---|
| 1 | Abstract, Sec. 7 | "Every detection method in the literature ... depends on order-level data or labeled cases that retail investors cannot access" | Overstated | Two recent studies used only public price and volume data with unsupervised models: Núñez Delafuente, Astudillo, and Díaz (2024) used hourly data and Isolation Forests; Chen and Hybinette (2026 preprint) used public minute-level Bank Nifty data. Ibikunle et al. also apply their model to public data. Say "most". |
| 2 | Abstract, Sec. 7 | "Only one of the five strategies, momentum ignition, operates on a timescale that public minute-level data can capture" | Overstated | Expiry-day index manipulation plays out over hours. Chen and Hybinette's minute-level detectors flagged 8 to 10 of the 10 SEBI-identified days in their 2024 test data. Spoofing and quote stuffing really are invisible in minute bars, and marking the close was the hardest case. |
| 3 | Sec. 1, para 2 | Names Citadel Securities, Virtu, Jane Street, and Hudson River Trading, then says "These firms rely on three main strategies: market making, latency arbitrage, and momentum ignition" | Unsupported | No source says these firms rely on momentum ignition, which is illegal manipulation. The sentence reads as an accusation against named companies. Describe HFT strategies in general. |
| 4 | Sec. 1, para 1; Sec. 5.1 | SEBI "barred the firm from Indian markets ... while the case continued" | Out of date | Jane Street deposited the ₹4,843.57 crore in escrow and SEBI lifted the ban on 21 July 2025. Jane Street appealed to the Securities Appellate Tribunal in September 2025. In October 2026 the tribunal was hearing a dispute over documents, and SEBI had issued no final order. |
| 5 | Sec. 1, para 1 | "on 18 expiry days" the firm moved Bank Nifty "up in the morning and down in the afternoon" | Partly true | SEBI examined 18 Bank Nifty expiry days and alleges that pattern on 15. The other 3, plus 3 Nifty expiries in May 2025, are a second allegation SEBI calls "extended marking the close". That makes 21 days in all. |
| 6 | Sec. 5.1 | SEBI's order "came four months after the last of the 18 expiry days" | False | The last of the 18 days was 10 July 2024 and the order is dated 3 July 2025, almost a year later. |
| 7 | Sec. 3.1 | Tse, Lin, and Vincent "gave the first detailed description of momentum ignition" | False | The SEC described momentum ignition in its January 2010 Concept Release on Equity Market Structure (Release 34-61358, Sec. IV.B), almost three years earlier. The Credit Suisse report does not claim to be first. |
| 8 | Sec. 1, para 2; Sec. 4 | Tighter spreads save retail investors "an estimated $10 billion a year" (Pomegra) | Unverifiable | No Pomegra page with that title could be found, and the figure traces to no original study. Replaced with peer-reviewed evidence that algorithmic trading narrows spreads (Hendershott, Jones, and Menkveld 2011; SEC Staff 2014). |
| 9 | Sec. 1, para 2 | Ibikunle et al. "find that liquidity-demanding HFTs push prices away from their true value" | Not in source | No version of the paper says this. It finds that liquidity-demanding HFT goes with slower price discovery around earnings announcements, and the latest version (October 2026) calls these associations, not causal effects. |
| 10 | Sec. 5.1 | The CAT described in the present tense as a full database of who placed each order | Out of date | Since 2025 the SEC has stopped CAT reporting of customers' personal information. A federal appeals court vacated the CAT funding order in July 2025. In August 2026 SEC Chairman Atkins told staff to draft a rule that would rescind Rule 613, with a transition likely lasting until late 2027. The CAT still runs today. |

## Medium priority: wrong numbers, missing context, citation errors

| # | Where | Issue | Fix |
|---|---|---|---|
| 11 | Sec. 1, para 1 | "$554 million" | Reported at the time as about $567 million. The dollar value moves with the rupee. |
| 12 | Sec. 1, para 1 | "After 11:49 a.m., it sold" | Correct, but only for SEBI's example day, 17 January 2024 (buying 9:15 to 11:46:59, selling from 11:49). Name the day. |
| 13 | Sec. 3.5 | SEBI "attributed the entire positive price impact ... on several days to Jane Street alone" | SEBI shows this for 17 January 2024: Jane Street's index-weighted impact was +49,048 against -49,194 for all other participants combined. "Several days" could not be confirmed in the parts of the order that were readable. |
| 14 | Sec. 1, para 2; Sec. 4 | Baron, Brogaard, and Kirilenko | The numbers ($3.49, $1.92, $23 million) check out in the 2012 NBER draft. But the CFTC data identify accounts, not "every trader"; the trader types are the authors' own classifications ("fundamental" traders, not "institutions"); and the profits are gross and short-term. The published version (Journal of Financial and Quantitative Analysis, 2019, with Hagströmer) uses Swedish stock data and drops these numbers. |
| 15 | Sec. 1, para 2 | "Retail investors take the largest losses" | One futures study cannot support "largest". Reworded to "small traders appear to pay more". |
| 16 | Abstract | "The evidence on harm points in one direction" | One direct measurement plus a simulation is thin, and Sec. 4 itself describes benefits. Softened. |
| 17 | Sec. 3.1 | Tse et al.: events "occurring at least 1.6 times per stock per day" | 1.6 is an average, not a minimum, and it comes from European STOXX 600 stocks in Q3 2012. The average move was 38 basis points over about 1.5 minutes. The authors say their detector cannot establish intent. |
| 18 | Works Cited | Tse et al. URL (smallake.kr/.../448.pdf) | That PDF is a different paper, an unsigned 2015 draft called "An Empirical detection of HFT strategies" that cites Tse et al. No official URL for the Credit Suisse report was found, so it is now cited without one. |
| 19 | Sec. 4; Works Cited | "Xiao, Yin, and Li ... using real order book data" | The first author's family name is Jian (Jian Xiao), so cite "Jian, Yin, and Li". The 82 percent figure is model output: the 50-millisecond threshold is built into the model, and order book data only set up the simulated market. |
| 20 | Sec. 1, para 1 | SEBI's 93 percent loss figure (FY22-24) | Correct, but newer data exist. SEBI's August 2026 study: 90.9 percent lost money in FY25 and 87.7 percent in FY26, with FY26 net losses of ₹91,685 crore. |
| 21 | Sec. 3.5 | Expiry-day manipulation section | India changed its expiry-day rules after November 2024: one weekly index expiry per exchange, larger contracts, extra expiry-day margin, and intraday position monitoring from April 2025. Press reports say a closing auction session began in August 2026. Added. |
| 22 | Abstract; Sec. 1 | HFT is "almost half of U.S. equity volume" | The SEC's 2010 and 2014 documents say estimates are typically 50 percent or higher and depend on how HFT is defined. Ibikunle et al.'s latest version dropped "almost half". No newer official figure exists. Now reads "around half, depending on definition". |
| 23 | Sec. 3.4 | Athena: quote, "fined", "first ... case" | The SEC's exact words, from Enforcement Director Andrew Ceresney: "...but what happened here was fraud." Athena settled and paid a $1 million penalty without admitting or denying the findings, so "fined" is loose. The SEC's own label is its "first high frequency trading manipulation case". |
| 24 | Sec. 4 | CRS report on day traders | The report says day traders "may" be more affected, and it is summarizing a Canadian study by Malinova, Park, and Riordan. Both points added. |

## Low priority: precision and citation format

| # | Where | Fix |
|---|---|---|
| 25 | Sec. 3.2 | Coscia's markets were gold, soybean meal, soybean oil, high-grade copper, and euro and British pound currency futures, and he made "nearly" $1.4 million. Added that the Seventh Circuit upheld the conviction in 2017. |
| 26 | Sec. 5.3 | Golmohammadi et al. used SEC cases filed in 2003 only, covering 8 manipulated stocks (175,738 hourly observations). |
| 27 | Sec. 5.4 | Cao et al. injected synthetic manipulation into real tick data from seven NASDAQ and LSE stocks. |
| 28 | Sec. 3.3 | Egginton et al.: at least one quote-stuffing episode in over 74 percent of U.S. exchange-listed securities. |
| 29 | Sec. 1; Works Cited | "Pay millions" is not in the cited source. The Duke Law & Technology Review piece is a student note by Jacob Adrian (vol. 14, 2016), which describes co-location and direct feeds costing tens of thousands of dollars a month. Author added, wording fixed. |
| 30 | Sec. 2 | Putniņš is now cited as the published Wiley chapter (2020, pp. 13-44). Trade-based and order-based manipulation are two of the five categories he describes. |
| 31 | Works Cited | Ibikunle et al. is now cited as arXiv version 4 (5 October 2026). |
| 32 | Works Cited | SignalPilot and Pomegra are educational websites, not research. Both were replaced with peer-reviewed sources. Kansal's blog post was replaced with SEBI's order itself. |
| 33 | Throughout | MLA 9 uses "et al." for three or more authors. Your paper names all three in text (for example "Brogaard, Hendershott, and Riordan"). That convention is kept and applied consistently, but check what your teacher expects. |

## Verified as written

Brogaard, Hendershott, and Riordan (2014); Budish, Cramton, and Shim (2015); Kirilenko et al. on the Flash Crash (2017); Lee, Eom, and Park (2013); Liu, Ting, and Zhou on Isolation Forest (2008). On Athena: the June to December 2009 dates, the "Gravy" algorithm, over 70 percent of closing-second volume, and the $1 million amount. On Coscia: the 2015 conviction and three-year sentence. Also verified: Rule 613 (2012) and the CAT plan approval (2016); SEBI's 93 percent and ₹1.8 lakh crore figures; the ₹4,843.57 crore impounded; Golmohammadi et al.'s eight algorithms, 64 companies, and the 89/83 percent Naive Bayes result; and the existence and 82 percent figure of the Jian, Yin, and Li paper.

## Could not fully check

The Putniņš chapter text (paywalled). Annexure 2 of SEBI's order, which has the day-by-day tables. Some Jane Street tribunal coverage, which is paywalled or reported by a single outlet. The closing-auction details for India come from one PTI report, so confirm them on NSE or SEBI before you rely on them.

## New research added to the paper

| Source | What it adds | Section |
|---|---|---|
| SEC, Concept Release on Equity Market Structure (2010) | First regulator description of momentum ignition; HFT share of volume | 1, 3.1 |
| Aquilina, Budish, and O'Neill, QJE (2022) | Latency-arbitrage races measured in real data: about one per minute per FTSE 100 stock, about 20 percent of volume, a 0.5 bp "tax", about $5 billion a year globally | 2, 4 |
| Shkilko and Sokolov, Journal of Finance (2020) | When weather cut fast traders' microwave links, trading costs fell | 2 |
| Menkveld, Journal of Financial Markets (2013); Hendershott, Jones, and Menkveld, Journal of Finance (2011) | Peer-reviewed sources for market making and spread narrowing | 1, 2, 4 |
| SEC v. Harsh V. Patel (2026) | Recent U.S. case with a momentum-ignition-like pattern | 3.1 |
| Tao et al., Quantitative Finance (2022); Do and Putniņš (2023) | Current spoofing detection, which still needs order-book data | 3.2, 5.3 |
| Comerton-Forde and Putniņš, Review of Finance (2014) | About 1 percent of closing prices are manipulated, and few cases are caught | 3.4, 5.4 |
| Chang et al., Journal of Derivatives (2025) | Expiry-day cross-market manipulation in Taiwan | 3.5 |
| Schwarz et al., Journal of Finance (2025); Bryzgalova, Pavlova, and Sikorskaya, Journal of Finance (2023) | What U.S. retail traders actually pay in stocks and options | 4 |
| Alfajeer et al. (2025) | Systematic review of 66 detection studies | 1, 5.3 |
| Poutré, Chételat, and Morales (2024) | Unsupervised transformer autoencoder on order-book data | 5.4 |
| Núñez Delafuente, Astudillo, and Díaz (2024) | Isolation Forests on hourly public data: up to 89 percent recall, 2 to 6 percent precision | 5.4 |
| Chen and Hybinette (2026, arXiv preprint) | Minute-level detectors on public Bank Nifty data recover SEBI's Jane Street days | 5.4 |
| Dim, Eraker, and Vilkov (2024) | Same-day options hedging creates legitimate pump-like price shapes | 5.4 |
| SEBI study, circular, order, and press releases (2024-2026); SEC and court documents on the CAT (2025-2026) | Case and rule updates | 1, 3.5, 5.1 |

## Notes for Section 6 (methods), which is still blank

- Expect most alerts to be false alarms. Published tests put Isolation Forest precision between 2 and 26 percent, and only about 1 percent of closing prices are estimated to be manipulated. Report results as "unusual windows", and measure precision and recall on known cases.
- A 1.5-minute momentum-ignition event covers only one or two 1-minute bars. Consider rolling windows or features that compare a bar with the few bars around it.
- Order imbalance is not in OHLCV bars. Either get trade-and-quote data or say how you approximate it, for example by signing trades with the tick rule.
- Public labels you can test against: the dates in SEBI's Jane Street order, SEC litigation releases such as Patel (2026), and the SEC 2003 cases used by Golmohammadi et al. and Núñez Delafuente et al.
- Chen and Hybinette (2026) is the closest prior work to your project. Say how yours differs, for example U.S. equities instead of Indian index options.
