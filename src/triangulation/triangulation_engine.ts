import { SignalEstimator } from '../radio/signal_estimator';
import { ingestRadioPayload } from '../radio/ingestion';
import { GeoPoint, KmlIngestionPayloadDto, SignalForecast, TriangulationStatus } from '../types/radio';

export interface TriangulationDecision {
  status: TriangulationStatus;
  reason: string;
  signalForecast: SignalForecast;
}

export class TriangulationEngine {
  constructor(private readonly signalEstimator: SignalEstimator) {}

  evaluatePoint(
    point: GeoPoint,
    payload: KmlIngestionPayloadDto,
  ): TriangulationDecision {
    const { stations: visibleStations, samples: signalSamples } = ingestRadioPayload(payload);
    const signalForecast = this.signalEstimator.forecastAtPoint(point, visibleStations, signalSamples);

    if (signalForecast.triangulationStatus === 'available') {
      return {
        status: 'available',
        reason: 'Прогноз сигнала достаточен для большинства видимых станций.',
        signalForecast,
      };
    }

    if (signalForecast.triangulationStatus === 'degraded') {
      return {
        status: 'degraded',
        reason: 'Для части станций прогноз ниже порога, триангуляция будет нестабильной.',
        signalForecast,
      };
    }

    return {
      status: 'unavailable',
      reason: 'Для большинства станций прогноз ниже порога, триангуляция недоступна.',
      signalForecast,
    };
  }
}
