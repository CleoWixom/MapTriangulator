import { SignalEstimator } from './radio/signal_estimator';
import { TriangulationEngine } from './triangulation/triangulation_engine';
import { SignalSample, StationVisibility } from './types/radio';
import { renderPredictionCardHtml } from './ui/signal_prediction_card';

export interface TriangulationContext {
  stations: StationVisibility[];
  samples: SignalSample[];
}

/**
 * Интеграционный helper для обработчика клика по карте.
 */
export function onMapPointClick(
  lat: number,
  lon: number,
  context: TriangulationContext,
): { html: string; status: 'available' | 'degraded' | 'unavailable' } {
  const estimator = new SignalEstimator();
  estimator.calibrateFromSamples(context.samples, context.stations);

  const engine = new TriangulationEngine(estimator);
  const decision = engine.evaluatePoint({ lat, lon }, context.stations, context.samples);

  return {
    html: renderPredictionCardHtml(decision.signalForecast),
    status: decision.status,
  };
}
