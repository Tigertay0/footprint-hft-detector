import type { Locale } from "./i18n";

type L = Record<Locale, string>;

export type FigureId =
  | "expiry"
  | "spread"
  | "race"
  | "whoPays"
  | "timeline"
  | "iforest"
  | "features"
  | "score"
  | "dial"
  | "controls"
  | "clustering"
  | "planted"
  | "baseRate";

export interface Note {
  kind: "note";
  title: L;
  body: L;
}

export interface FigureSlot {
  kind: "figure";
  id: FigureId;
  wide?: boolean;
}

export type Attachment = Note | FigureSlot;

const note = (title: L, body: L): Note => ({ kind: "note", title, body });
const fig = (id: FigureId, wide = false): FigureSlot => ({ kind: "figure", id, wide });

/** Plain-language notes (margin on wide screens, inline below the paragraph on narrow ones) and figures, by paragraph id. */
export const ATTACH: Record<string, Attachment[]> = {
  "s1-p1": [
    note(
      { en: "Index options and expiry day", fr: "Options sur indice et jour d'expiration" },
      {
        en: "An index such as Bank Nifty is an average of many stock prices. An index option is a bet on where that average will stand at a set moment, the expiry. On expiry day, a small push to the index can decide whether a large options position pays off.",
        fr: "Un indice comme le Bank Nifty est une moyenne de nombreux cours d'actions. Une option sur indice est un pari sur le niveau de cette moyenne à un moment fixé, l'expiration. Le jour de l'expiration, une petite poussée sur l'indice peut décider si une grosse position en options rapporte.",
      },
    ),
    fig("expiry"),
  ],
  "s1-p2": [
    note(
      { en: "High-frequency trading", fr: "Trading à haute fréquence" },
      {
        en: "Computer programs that buy and sell in thousandths or millionths of a second. Firms rent space for their servers inside the exchange's building, so their orders travel a few metres instead of a few kilometres.",
        fr: "Des programmes qui achètent et vendent en millièmes ou millionièmes de seconde. Les sociétés louent de la place pour leurs serveurs dans le bâtiment de la bourse : leurs ordres parcourent quelques mètres au lieu de quelques kilomètres.",
      },
    ),
  ],
  "s1-p4": [
    note(
      { en: "Who can see what", fr: "Qui voit quoi" },
      {
        en: "Regulators can see every order and which firm sent it. A retail investor sees prices and volumes, often a minute at a time, and nothing about who is trading.",
        fr: "Les régulateurs voient chaque ordre et la société qui l'a envoyé. Un investisseur particulier voit des prix et des volumes, souvent minute par minute, et rien sur qui négocie.",
      },
    ),
  ],
  "s2-p1": [
    note(
      { en: "Bid, ask and spread", fr: "Prix acheteur, prix vendeur, écart" },
      {
        en: "The bid is the best price someone will pay right now. The ask, or offer, is the best price someone will sell at. The gap between them is the spread, and it is the market maker's margin.",
        fr: "Le prix acheteur (bid) est le meilleur prix qu'on paierait tout de suite. Le prix vendeur (ask) est le meilleur prix auquel on vendrait. L'écart entre les deux est la marge du teneur de marché.",
      },
    ),
    fig("spread"),
  ],
  "s2-p2": [
    note(
      { en: "Basis point", fr: "Point de base" },
      {
        en: "One hundredth of one percent. Half a basis point on a $1,000 trade is 5 cents.",
        fr: "Un centième de pour cent. Un demi-point de base sur une transaction de 1 000 $ représente 5 cents.",
      },
    ),
    fig("race"),
  ],
  "s2-p4": [
    note(
      { en: "Two kinds of manipulation", fr: "Deux formes de manipulation" },
      {
        en: "Trade-based manipulation uses real trades. Order-based manipulation uses orders the trader never means to fill: they exist only to be seen by others.",
        fr: "La manipulation par les transactions utilise de vrais échanges. La manipulation par les ordres utilise des ordres que le trader ne compte jamais exécuter : ils n'existent que pour être vus.",
      },
    ),
  ],
  "s3-1-p1": [
    note(
      { en: "Why minute data can see it", fr: "Pourquoi les données minute le voient" },
      {
        en: "An event of about a minute and a half leaves a mark in one-minute bars: a burst of volume, a sharp push, then part of the move given back.",
        fr: "Un épisode d'environ une minute et demie laisse une trace dans les barres d'une minute : un pic de volume, une poussée brusque, puis une partie du mouvement rendue.",
      },
    ),
  ],
  "s3-2-p1": [
    note(
      { en: "Why minute data cannot", fr: "Pourquoi les données minute ne le voient pas" },
      {
        en: "Spoof orders are placed and cancelled without ever trading. One-minute bars only record trades, so the fake wall of orders never appears in them.",
        fr: "Les ordres fictifs sont placés puis annulés sans jamais être exécutés. Les barres d'une minute n'enregistrent que des transactions : le faux mur d'ordres n'y apparaît jamais.",
      },
    ),
  ],
  "s3-3-p1": [
    note(
      { en: "Too fast to see", fr: "Trop rapide pour être vu" },
      {
        en: "Quote stuffing happens in milliseconds, in the stream of quotes. One-minute bars contain no quotes at all.",
        fr: "Le bourrage de cotations se joue en millisecondes, dans le flux des cotations. Les barres d'une minute ne contiennent aucune cotation.",
      },
    ),
  ],
  "s3-4-p1": [
    note(
      { en: "Why the close matters", fr: "Pourquoi la clôture compte" },
      {
        en: "Funds, indexes and contracts settle at the closing price, so a few seconds of pushing can be worth a lot. A one-minute bar blurs those seconds into a single number.",
        fr: "Fonds, indices et contrats se règlent au cours de clôture : quelques secondes de poussée peuvent valoir cher. Une barre d'une minute fond ces secondes en un seul chiffre.",
      },
    ),
  ],
  "s3-5-p1": [
    note(
      { en: "Two markets, one plan", fr: "Deux marchés, un seul plan" },
      {
        en: "The push happens in stocks and futures, the profit in options. Someone watching only one market misses the link.",
        fr: "La poussée se fait sur les actions et les contrats à terme, le gain sur les options. Qui ne regarde qu'un seul marché ne voit pas le lien.",
      },
    ),
  ],
  "s4-p1": [
    note(
      { en: "How big is $3.49?", fr: "Que représentent 3,49 $ ?" },
      {
        en: "One E-mini S&P 500 contract was worth about $50,000 in 2010. $3.49 on it is roughly 0.7 basis points: small per trade, large over millions of trades.",
        fr: "Un contrat E-mini S&P 500 valait environ 50 000 $ en 2010. 3,49 $ représente donc environ 0,7 point de base : peu par transaction, beaucoup sur des millions.",
      },
    ),
    fig("whoPays", true),
  ],
  "s4-p3": [
    note(
      { en: "Latency", fr: "Latence" },
      {
        en: "The time a message takes to travel between a trader and the exchange. 50 milliseconds is one twentieth of a second.",
        fr: "Le temps que met un message pour aller du trader à la bourse. 50 millisecondes, c'est un vingtième de seconde.",
      },
    ),
  ],
  "s4-p5": [
    note(
      { en: "Round trip", fr: "Aller-retour" },
      {
        en: "Buying a stock and selling it again. Its cost includes crossing the spread twice and the price the broker's wholesaler gives you.",
        fr: "Acheter une action puis la revendre. Le coût inclut l'écart payé deux fois et le prix accordé par le grossiste du courtier.",
      },
    ),
  ],
  "s5-1-p1": [
    note(
      { en: "Interim order", fr: "Ordonnance provisoire" },
      {
        en: "A temporary order while a case continues. It is not a final finding, and the firm can contest it.",
        fr: "Une décision temporaire pendant que l'affaire suit son cours. Ce n'est pas une conclusion définitive, et la société peut la contester.",
      },
    ),
    fig("timeline", true),
  ],
  "s5-2-p1": [
    note(
      { en: "A checklist", fr: "Une liste de contrôle" },
      {
        en: "A rule-based detector works like a checklist: if all three steps happen, raise a flag. Easy to explain, and easy to dodge by changing one step.",
        fr: "Un détecteur à règles fonctionne comme une liste de contrôle : si les trois étapes se produisent, il lève un drapeau. Facile à expliquer, et facile à contourner en changeant une étape.",
      },
    ),
  ],
  "s5-3-p1": [
    note(
      { en: "Labels", fr: "Étiquettes" },
      {
        en: "Examples that someone has already marked as manipulation. Few exist, and they only show the cases regulators caught.",
        fr: "Des exemples que quelqu'un a déjà marqués comme manipulation. Ils sont rares, et ne montrent que les cas que les régulateurs ont attrapés.",
      },
    ),
  ],
  "s5-4-p1": [
    note(
      { en: "Isolation Forest in one line", fr: "L'Isolation Forest en une phrase" },
      {
        en: "Ask random yes-or-no questions (was volume above this? was the move above that?) until a minute stands alone. Strange minutes are isolated after a few questions, ordinary ones need many.",
        fr: "Poser des questions au hasard (le volume dépassait-il ceci ? le mouvement dépassait-il cela ?) jusqu'à ce qu'une minute se retrouve seule. Les minutes étranges sont isolées en quelques questions, les ordinaires en demandent beaucoup.",
      },
    ),
    fig("iforest"),
  ],
  "s5-4-p2": [
    note(
      { en: "Precision", fr: "Précision" },
      {
        en: "Of everything a model flags, the share that was really manipulation. Two to six percent means most flags were false alarms.",
        fr: "Parmi tout ce qu'un modèle signale, la part qui était vraiment de la manipulation. Deux à six pour cent : la plupart des signalements étaient de fausses alertes.",
      },
    ),
  ],
  "s5-5-p1": [
    note(
      { en: "Measuring without seeing", fr: "Mesurer sans voir" },
      {
        en: "Public data does not say who is an HFT firm. A model trained where the answer is known can estimate it where it is not.",
        fr: "Les données publiques ne disent pas qui est une société de HFT. Un modèle entraîné là où la réponse est connue peut l'estimer là où elle ne l'est pas.",
      },
    ),
  ],
  "s6-p1": [
    note(
      { en: "One-minute bar", fr: "Barre d'une minute" },
      {
        en: "For each minute: the first price, the highest, the lowest, the last, and how many shares traded. Nothing about who traded, or which orders were waiting.",
        fr: "Pour chaque minute : le premier prix, le plus haut, le plus bas, le dernier, et le nombre d'actions échangées. Rien sur qui a négocié, ni sur les ordres en attente.",
      },
    ),
  ],
  "s6-p2": [
    note(
      { en: "Standard deviations", fr: "Écarts-types" },
      {
        en: "A way to say how unusual a number is compared with its recent past. 2.5 standard deviations above normal happens in well under one minute in a hundred.",
        fr: "Une façon de dire à quel point un chiffre est inhabituel par rapport à son passé récent. 2,5 écarts-types au-dessus de la normale arrive bien moins d'une minute sur cent.",
      },
    ),
    fig("features"),
  ],
  "s6-p3": [
    note(
      { en: "Trained, then tested", fr: "Entraîné, puis testé" },
      {
        en: "The model learned what normal looks like from 12 days and was judged on the next 8, which it had never seen.",
        fr: "Le modèle a appris à quoi ressemble la normale sur 12 jours, puis a été jugé sur les 8 suivants, qu'il n'avait jamais vus.",
      },
    ),
    fig("score"),
  ],
  "s6-p4": [
    note(
      { en: "Two stages", fr: "Deux étapes" },
      {
        en: "The early warning goes out the moment a minute looks odd. The verdict needs five more minutes of prices, to see whether the move reversed or held.",
        fr: "L'alerte précoce part dès qu'une minute semble anormale. Le verdict demande cinq minutes de prix de plus, pour voir si le mouvement s'est inversé ou a tenu.",
      },
    ),
  ],
  "s6-p6": [
    note(
      { en: "Market-wide", fr: "À l'échelle du marché" },
      {
        en: "When many unrelated stocks jump in the same minute, news or a large index trade is the likelier cause than someone pushing one stock.",
        fr: "Quand beaucoup d'actions sans lien bougent dans la même minute, une nouvelle ou un gros ordre sur un indice est une cause plus probable qu'une poussée sur une seule action.",
      },
    ),
  ],
  "s6-p11": [fig("dial", true)],
  "s6-p12": [
    note(
      { en: "Shuffling", fr: "Mélanger" },
      {
        en: "Keep every minute of the day but scramble their order. Anything that depends on time order disappears, so what is left is what the detector finds in noise.",
        fr: "Garder chaque minute de la journée mais en brouiller l'ordre. Tout ce qui dépend de l'ordre du temps disparaît : il reste ce que le détecteur trouve dans du bruit.",
      },
    ),
    fig("controls"),
  ],
  "s6-p13": [fig("clustering", true)],
  "s6-p14": [
    note(
      { en: "Planted events", fr: "Événements implantés" },
      {
        en: "Fake push-and-reverse patterns added to real data, so the right answer is known. Real manipulation would not be built to match the rules.",
        fr: "De faux schémas de poussée puis de retour ajoutés à des données réelles, pour connaître la bonne réponse. Une vraie manipulation ne serait pas construite pour correspondre aux règles.",
      },
    ),
    fig("planted"),
  ],
  "s6-p15": [
    note(
      { en: "Base rate", fr: "Taux de base" },
      {
        en: "When the real thing is rare, even a good alarm rings mostly for nothing. That is why a flag means wait and look, not buy or sell.",
        fr: "Quand le vrai phénomène est rare, même une bonne alarme sonne surtout pour rien. C'est pourquoi un signal veut dire attendre et regarder, pas acheter ou vendre.",
      },
    ),
    fig("baseRate", true),
  ],
};

/** Numbers that carry an argument get the marker sweep (first occurrence in the section). */
export const MARKS: Record<Locale, Record<string, string[]>> = {
  en: {
    s4: ["$3.49 per contract", "$1.92 per contract", "about 82 percent more per contract"],
    s6: ["4.9 per stock per trading day", "28 percent", "78 percent of them", "about one per stock every eight trading days", "990 of every 1,000 alerts would be false"],
  },
  fr: {
    s4: ["3,49 $ par contrat", "1,92 $ par contrat", "82 % de plus par contrat"],
    s6: ["4,9 par action et par jour de bourse", "28 %", "78 %", "environ une par action tous les huit jours de bourse", "990 alertes sur 1 000 seraient fausses"],
  },
};
