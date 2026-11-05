export type Locale = "en" | "fr";

export const LOCALES: readonly Locale[] = ["en", "fr"];

export const HOME: Record<Locale, string> = { en: "/", fr: "/fr/" };

export interface UiStrings {
  research: string;
  langLabel: string;
  startReading: string;
  jumpToResults: string;
  eyebrow: string;
  headlineLead: string;
  headlineEm: string;
  headlineTail: string;
  deck: string;
  paperTitle: string;
  stats: { value: number; decimals?: number; suffix?: string; label: string }[];
  heroCard: { app: string; now: string };
  heroChartLabel: string;
  heroTag: string;
  statementLead: string;
  statementRest: string;
  bandLead: string;
  bandRest: string;
  shortVersionTitle: string;
  shortVersion: string[];
  abstractLabel: string;
  plainLabel: string;
  sections: string;
  sourceLabel: string;
  openSource: string;
  close: string;
  readSub: (num: string) => string;
  backToTop: string;
  footerData: string;
  footerCode: string;
  zenodo: { record: string; pdf: string; doi: string; preprint: string; cite: string; license: string };
  translationNote: string | null;
  figure: string;
  numberLocale: string;
  meta: { title: string; description: string };
}

export const UI: Record<Locale, UiStrings> = {
  en: {
    research: "Research",
    langLabel: "Language",
    startReading: "Start reading",
    jumpToResults: "Jump to the results",
    eyebrow: "Preprint, 25 October 2026",
    headlineLead: "Can a retail investor see ",
    headlineEm: "machine-speed",
    headlineTail: " manipulation coming?",
    deck: "How high-frequency manipulation works, who pays for it, and what a simple warning tool sees in 20 real stocks. The full paper, with notes in plain words.",
    paperTitle: "High-Frequency Trading and Retail Investors: A Review of Manipulation Research and a Detection Model",
    stats: [
      { value: 155954, label: "minutes of real market data" },
      { value: 20, label: "U.S. stocks and funds" },
      { value: 4.9, decimals: 1, label: "alerts per stock per day" },
      { value: 28, suffix: "%", label: "of alerts were market-wide" },
    ],
    heroCard: { app: "ntfy", now: "now" },
    heroChartLabel: "A one-minute price line is pushed up sharply, then snaps back, and the phone receives an early warning",
    heroTag: "One-minute price, illustration",
    statementLead: "Regulators can see every order, and the firm that placed it.",
    statementRest: " A retail investor sees prices and volumes, often one minute at a time, and nothing that says whether a price is being pushed. Enforcement, when it comes, arrives years later. This paper asks what that one-minute view can show.",
    bandLead: "Your phone on 8 October",
    bandRest: " {n} notifications from 20 stocks",
    shortVersionTitle: "The short version",
    shortVersion: [
      "Five kinds of high-frequency manipulation show up again and again in research and court cases. Only two are slow enough to show up in the free one-minute data an ordinary investor can get.",
      "Small, active traders seem to pay the most, but no study measures what manipulation itself costs them.",
      "A simple detector on 20 real stocks sent about five alerts per stock per day. Shuffled data gave the same rate, so the number is a setting, not proof of manipulation.",
    ],
    abstractLabel: "Abstract",
    plainLabel: "In plain words",
    sections: "Sections",
    sourceLabel: "Source",
    openSource: "Open the source",
    close: "Close",
    readSub: (num) => `Read ${num}`,
    backToTop: "Back to top",
    footerData: "Data: Yahoo Finance one-minute bars, 21 September to 16 October 2026.",
    footerCode: "Code and raw bars are available from the author.",
    zenodo: { record: "Read on Zenodo", pdf: "Download the PDF", doi: "DOI", preprint: "Preprint on Zenodo", cite: "Cite this paper", license: "Licensed CC BY 4.0" },
    translationNote: null,
    figure: "Figure",
    numberLocale: "en-US",
    meta: {
      title: "Can a retail investor see machine-speed manipulation coming? | Adetayo Agueh",
      description:
        "A research paper on high-frequency trading manipulation, who pays for it, and a test of a warning tool on free one-minute data, with plain-language notes and animated figures.",
    },
  },
  fr: {
    research: "Recherche",
    langLabel: "Langue",
    startReading: "Commencer la lecture",
    jumpToResults: "Aller aux résultats",
    eyebrow: "Prépublication, 25 octobre 2026",
    headlineLead: "Un investisseur particulier peut-il voir venir une manipulation ",
    headlineEm: "à la vitesse des machines",
    headlineTail: " ?",
    deck: "Comment fonctionne la manipulation à haute fréquence, qui en paie le prix, et ce qu'un outil d'alerte simple voit sur 20 actions réelles. L'article complet, avec des notes en clair.",
    paperTitle: "Le trading à haute fréquence et les investisseurs particuliers : revue de la recherche sur la manipulation et modèle de détection",
    stats: [
      { value: 155954, label: "minutes de données de marché réelles" },
      { value: 20, label: "actions et fonds américains" },
      { value: 4.9, decimals: 1, label: "alertes par action et par jour" },
      { value: 28, suffix: " %", label: "des alertes touchaient tout le marché" },
    ],
    heroCard: { app: "ntfy", now: "maintenant" },
    heroChartLabel: "Une courbe de prix à la minute est poussée vers le haut, puis revient, et le téléphone reçoit une alerte précoce",
    heroTag: "Prix à la minute, illustration",
    statementLead: "Les régulateurs voient chaque ordre, et la société qui l'a passé.",
    statementRest: " Un investisseur particulier voit des prix et des volumes, souvent minute par minute, et rien qui lui dise si un cours est poussé. La sanction, quand elle vient, arrive des années plus tard. Cet article se demande ce que cette vue à la minute peut montrer.",
    bandLead: "Votre téléphone le 8 octobre",
    bandRest: " {n} notifications pour 20 actions",
    shortVersionTitle: "En bref",
    shortVersion: [
      "Cinq formes de manipulation à haute fréquence reviennent sans cesse dans la recherche et les affaires judiciaires. Seules deux sont assez lentes pour apparaître dans les données gratuites à la minute qu'un investisseur ordinaire peut obtenir.",
      "Les petits traders actifs semblent payer le plus, mais aucune étude ne mesure ce que la manipulation elle-même leur coûte.",
      "Un détecteur simple, testé sur 20 actions réelles, a envoyé environ cinq alertes par action et par jour. Des données mélangées donnent le même chiffre : c'est un réglage, pas une preuve de manipulation.",
    ],
    abstractLabel: "Résumé",
    plainLabel: "En clair",
    sections: "Sections",
    sourceLabel: "Source",
    openSource: "Ouvrir la source",
    close: "Fermer",
    readSub: (num) => `Lire ${num}`,
    backToTop: "Retour en haut",
    footerData: "Données : barres d'une minute Yahoo Finance, du 21 septembre au 16 octobre 2026.",
    footerCode: "Le code et les barres brutes sont disponibles auprès de l'auteur.",
    zenodo: { record: "Lire sur Zenodo", pdf: "Télécharger le PDF (en anglais)", doi: "DOI", preprint: "Prépublication sur Zenodo", cite: "Citer cet article", license: "Sous licence CC BY 4.0" },
    translationNote:
      "Traduction de l'article original en anglais. Les notifications du téléphone restent en anglais, comme l'outil les envoie.",
    figure: "Figure",
    numberLocale: "fr-FR",
    meta: {
      title: "Un investisseur particulier peut-il voir venir une manipulation à la vitesse des machines ? | Adetayo Agueh",
      description:
        "Un article de recherche sur la manipulation par le trading à haute fréquence, ceux qui en paient le prix, et le test d'un outil d'alerte sur des données gratuites à la minute, avec des notes en clair et des figures animées.",
    },
  },
};
