import type { Locale } from "@/content/i18n";
import type { FigureId } from "@/content/notes";
import { ExpiryFigure, RaceFigure, SpreadFigure } from "./basics";
import { TimelineFigure, WhoPaysFigure } from "./evidence";
import { FeaturesFigure, IForestFigure, ScoreFigure } from "./model";
import { BaseRateFigure, ClusteringFigure, ControlsFigure, DialFigure, PlantedFigure } from "./results";

const MAP: Record<FigureId, (p: { locale: Locale; n: string }) => React.ReactNode> = {
  expiry: ExpiryFigure,
  spread: SpreadFigure,
  race: RaceFigure,
  whoPays: WhoPaysFigure,
  timeline: TimelineFigure,
  iforest: IForestFigure,
  features: FeaturesFigure,
  score: ScoreFigure,
  dial: DialFigure,
  controls: ControlsFigure,
  clustering: ClusteringFigure,
  planted: PlantedFigure,
  baseRate: BaseRateFigure,
};

export function FigureById({ id, locale, n }: { id: FigureId; locale: Locale; n: string }) {
  const Component = MAP[id];
  return <Component locale={locale} n={n} />;
}
