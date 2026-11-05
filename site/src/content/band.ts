import type { Locale } from "./i18n";

type L = Record<Locale, string>;

/** The band in Section 6: paragraphs 7-10 of the paper, interleaved with replay steps. `t` is HH:MM New York time. */
export type BandBlock = { kind: "para"; id: string; t: string } | { kind: "step"; t: string; time: L; text: L };

export const BAND_INTRO: { body: L } = {
  body: {
    en: "Had you watched the study's 20 stocks with the tool on 8 October, using the watcher's default settings, these are the notifications your phone would have received. The phone follows your reading through the day.",
    fr: "Si vous aviez surveillé les 20 actions de l'étude avec l'outil le 8 octobre, avec les réglages par défaut, voici les notifications qu'aurait reçues votre téléphone. Le téléphone suit votre lecture au fil de la journée. Les notifications restent en anglais, comme l'outil les envoie.",
  },
};

export const BAND: BandBlock[] = [
  { kind: "para", id: "s6-p7", t: "09:50" },
  {
    kind: "step", t: "09:55", time: { en: "09:55", fr: "9 h 55" },
    text: {
      en: "The first two early warnings: SOXL and SQQQ. Each says what looked odd and that the tool is watching for a reversal.",
      fr: "Les deux premières alertes précoces : SOXL et SQQQ. Chacune dit ce qui semblait anormal, et que l'outil guette un retour.",
    },
  },
  {
    kind: "step", t: "10:02", time: { en: "10:02", fr: "10 h 02" },
    text: {
      en: "Both moves held, so both warnings are cleared. A cleared message arrives silently.",
      fr: "Les deux mouvements ont tenu : les deux alertes sont levées. Un message de levée arrive en silence.",
    },
  },
  { kind: "para", id: "s6-p8", t: "10:30" },
  {
    kind: "step", t: "11:49", time: { en: "11:49", fr: "11 h 49" },
    text: {
      en: "The first confirmed pattern: META. Five minutes after its warning, enough of the move had reversed, so this one arrives as urgent.",
      fr: "Le premier schéma confirmé : META. Cinq minutes après l'alerte, une part suffisante du mouvement s'était inversée : celle-ci arrive en urgent.",
    },
  },
  { kind: "para", id: "s6-p9", t: "12:00" },
  {
    kind: "step", t: "12:18", time: { en: "12:17", fr: "12 h 17" },
    text: {
      en: "Nine of the 20 stocks alert in the same minute. Five warnings land at once, and the watcher's limit of 20 warnings an hour kicks in.",
      fr: "Neuf des 20 actions alertent dans la même minute. Cinq alertes arrivent d'un coup, et la limite de 20 alertes par heure se déclenche.",
    },
  },
  {
    kind: "step", t: "12:25", time: { en: "12:25", fr: "12 h 25" },
    text: {
      en: "Seven confirmations in two minutes. They all moved together, which points to news or a market-wide trade rather than one stock being pushed.",
      fr: "Sept confirmations en deux minutes. Tout a bougé ensemble, ce qui évoque une nouvelle ou un échange à l'échelle du marché plutôt qu'une action poussée seule.",
    },
  },
  { kind: "para", id: "s6-p10", t: "12:40" },
  {
    kind: "step", t: "12:54", time: { en: "12:54", fr: "12 h 54" },
    text: {
      en: "Warnings held back by the limit come through as digests. Urgent alerts never wait.",
      fr: "Les alertes retenues par la limite arrivent en résumés groupés. Les alertes urgentes n'attendent jamais.",
    },
  },
  {
    kind: "step", t: "15:31", time: { en: "15:31", fr: "15 h 31" },
    text: {
      en: "A second burst late in the afternoon: SOXL, PLTR and HOOD confirmed within three minutes",
      fr: "Une seconde rafale en fin d'après-midi : SOXL, PLTR et HOOD confirmées en trois minutes",
    },
  },
  {
    kind: "step", t: "16:00", time: { en: "16:00", fr: "16 h 00" },
    text: {
      en: "Market closed. The day's summary for 20 stocks: 87 early warnings (7 of them held back and sent in digests), 35 confirmed, 69 cleared.",
      fr: "Marché fermé. Le bilan du jour pour 20 actions : 87 alertes précoces (dont 7 retenues puis envoyées en résumés), 35 confirmées, 69 levées.",
    },
  },
];

export const BAND_LABELS: Record<Locale, { date: string; app: string; quiet: string; empty: string; early: string; cleared: string; confirmed: string; phoneLabel: string }> = {
  en: {
    date: "Thursday, 8 October",
    app: "ntfy",
    quiet: "silent",
    empty: "No alerts yet. The market opened at 09:30; scoring starts once each stock has about 20 minutes of data.",
    early: "Early warnings",
    cleared: "Cleared",
    confirmed: "Confirmed",
    phoneLabel: "A phone replaying the detector's notifications for 8 October 2026",
  },
  fr: {
    date: "jeudi 8 octobre",
    app: "ntfy",
    quiet: "silencieux",
    empty: "Aucune alerte pour l'instant. Le marché a ouvert à 9 h 30 ; le calcul commence quand chaque action a environ 20 minutes de données.",
    early: "Alertes précoces",
    cleared: "Levées",
    confirmed: "Confirmées",
    phoneLabel: "Un téléphone qui rejoue les notifications du détecteur pour le 8 octobre 2026",
  },
};
