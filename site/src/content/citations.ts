/**
 * Maps the citation text used in the paper to its Works Cited entry. `key` is a unique substring of the entry.
 * Parenthetical citations are matched exactly; `running` names are linked where they appear in prose
 * (first mention per section). French prose writes "et" for "and", so a French variant is derived.
 */
export interface CitationAlias {
  cite: string;
  key: string;
  running?: boolean;
}

export const CITATIONS: CitationAlias[] = [
  { cite: "Aitken, Cumming, and Zhan", key: "Aitken, Michael", running: true },
  { cite: "American Securities Association v. SEC", key: "American Securities Association v." },
  { cite: "Aquilina, Budish, and O'Neill", key: "Aquilina, Matteo", running: true },
  { cite: "Atkins", key: "Atkins, Paul" },
  { cite: "Baron, Brogaard, and Kirilenko", key: "The Trading Profits of High Frequency Traders", running: true },
  { cite: "Baron et al.", key: "Risk and Return in High-Frequency Trading" },
  { cite: "Brogaard, Hendershott, and Riordan", key: "Brogaard, Jonathan", running: true },
  { cite: "Bryzgalova, Pavlova, and Sikorskaya", key: "Bryzgalova, Svetlana" },
  { cite: "Budish, Cramton, and Shim", key: "Budish, Eric", running: true },
  { cite: "Cao et al.", key: "Cao, Yi", running: true },
  { cite: "Chen and Hybinette", key: "Chen, Alex", running: true },
  { cite: "Citadel Securities", key: "Citadel Securities. \"Equities.\"" },
  { cite: "Comerton-Forde and Putniņš", key: "Comerton-Forde, Carole", running: true },
  { cite: "Dim, Eraker, and Vilkov", key: "Dim, Chukwuma" },
  { cite: "Duke Law & Technology Review", key: "Duke Law & Technology Review. \"Informational" },
  { cite: "Egginton, Van Ness, and Van Ness", key: "Egginton, Jared", running: true },
  { cite: "Global Trading", key: "Global Trading. \"Jane Street" },
  { cite: "Golmohammadi, Zaiane, and Díaz", key: "Golmohammadi, Koosha", running: true },
  { cite: "Hendershott, Jones, and Menkveld", key: "Hendershott, Terrence" },
  { cite: "Ibikunle et al.", key: "Ibikunle, Gbenga", running: true },
  { cite: "IFLR", key: "IFLR. \"Primer" },
  { cite: "\"Jane Street Accuses\"", key: "\"Jane Street Accuses SEBI" },
  { cite: "Jian, Yin, and Li", key: "Jian, Xiao", running: true },
  { cite: "Kansal", key: "Kansal, Vishrut" },
  { cite: "Kirilenko et al.", key: "Kirilenko, Andrei, Albert", running: true },
  { cite: "Lee, Eom, and Park", key: "Lee, Eun Jung", running: true },
  { cite: "Liu, Ting, and Zhou", key: "Liu, Fei Tony", running: true },
  { cite: "Malinova, Park, and Riordan", key: "Malinova, Katya", running: true },
  { cite: "Núñez Delafuente, Astudillo, and Díaz", key: "Núñez Delafuente, Hugo", running: true },
  { cite: "Putniņš", key: "Putniņš, Tālis J. \"An Overview", running: true },
  { cite: "Schwarz et al.", key: "Schwarz, Christopher" },
  { cite: "SEBI, Interim Order", key: "SEBI. Interim Order" },
  { cite: "SEBI, \"Measures\"", key: "SEBI. \"Measures" },
  { cite: "SEBI, Profitability", key: "SEBI. Profitability" },
  { cite: "SEBI, \"Update\"", key: "SEBI. \"Update on" },
  { cite: "SEBI, \"Updated SEBI Study\"", key: "SEBI. \"Updated SEBI Study" },
  { cite: "SEC, Concept Release", key: "SEC. Concept Release" },
  { cite: "SEC, \"Harsh V. Patel\"", key: "SEC. \"Harsh V. Patel" },
  { cite: "SEC, \"Rule 613\"", key: "SEC. \"Rule 613" },
  { cite: "SEC, \"SEC Charges\"", key: "SEC. \"SEC Charges" },
  { cite: "SEC Staff", key: "SEC Staff. \"Equity Market" },
  { cite: "Shorter and Miller", key: "Shorter, Gary" },
  { cite: "SignalPilot", key: "SignalPilot Education" },
  { cite: "Tse, Lin, and Vincent", key: "Tse, Jonathan", running: true },
  { cite: "U.S. Attorney's Office", key: "U.S. Attorney's Office, Northern" },
  { cite: "Yahoo Finance", key: "Yahoo Finance. One-Minute" },
];

/** "Budish, Cramton, and Shim" -> "Budish, Cramton et Shim"; "Chen and Hybinette" -> "Chen et Hybinette". */
export function frenchRunning(cite: string): string {
  return cite.replace(/, and /g, " et ").replace(/ and /g, " et ");
}
