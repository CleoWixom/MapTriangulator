import {
  GeoPoint,
  SignalForecast,
  SignalPrediction,
  SignalQuality,
  SignalSample,
  StationVisibility,
} from '../types/radio';

interface StationCalibration {
  stationId: string;
  intercept: number;
  referenceDistanceM: number;
  pathLossExponent: number;
}

export interface SignalEstimatorOptions {
  /**
   * Типичный exponent для городской среды: 2.2..3.5.
   */
  pathLossExponent: number;
  referenceDistanceM: number;
  nearbyRadiusM: number;
  maxNearbySamples: number;
  idwPower: number;
  triangulationDbmThreshold: number;
  minVisibleStationsForTriangulation: number;
  majorityRatio: number;
}

const DEFAULT_OPTIONS: SignalEstimatorOptions = {
  pathLossExponent: 2.7,
  referenceDistanceM: 1,
  nearbyRadiusM: 1800,
  maxNearbySamples: 6,
  idwPower: 2,
  triangulationDbmThreshold: -112,
  minVisibleStationsForTriangulation: 3,
  majorityRatio: 0.6,
};

export class SignalEstimator {
  private readonly options: SignalEstimatorOptions;
  private calibrations: Map<string, StationCalibration> = new Map();

  constructor(options: Partial<SignalEstimatorOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  calibrateFromSamples(samples: SignalSample[], stationCatalog: StationVisibility[]): void {
    const groupedSamples = groupBy(samples, (s) => s.stationId);
    const stationMap = new Map(stationCatalog.map((s) => [s.stationId, s]));

    this.calibrations = new Map();

    for (const [stationId, stationSamples] of groupedSamples.entries()) {
      const station = stationMap.get(stationId);
      if (!station || stationSamples.length === 0) {
        continue;
      }

      const adjustedValues = stationSamples
        .map((sample) => {
          const d = Math.max(
            haversineDistanceMeters(sample.point, station.location),
            this.options.referenceDistanceM,
          );

          return sample.dbm + 10 * this.options.pathLossExponent * Math.log10(d / this.options.referenceDistanceM);
        })
        .filter(Number.isFinite);

      if (adjustedValues.length === 0) {
        continue;
      }

      const intercept = average(adjustedValues);

      this.calibrations.set(stationId, {
        stationId,
        intercept,
        referenceDistanceM: this.options.referenceDistanceM,
        pathLossExponent: this.options.pathLossExponent,
      });
    }
  }

  forecastAtPoint(target: GeoPoint, visibleStations: StationVisibility[], allSamples: SignalSample[]): SignalForecast {
    const samplesByStation = groupBy(allSamples, (s) => s.stationId);

    const perStation: SignalPrediction[] = visibleStations.map((station) => {
      const stationSamples = samplesByStation.get(station.stationId) ?? [];
      const baselineDbm = this.predictBaseline(target, station);
      const interpolatedDbm = this.interpolateResidual(target, station, stationSamples, baselineDbm);

      return {
        stationId: station.stationId,
        baselineDbm,
        interpolatedDbm,
        quality: classifySignal(interpolatedDbm),
        nearbySamplesUsed: this.selectNearbySamples(target, stationSamples).length,
      };
    });

    const overallScore = perStation.length > 0
      ? average(perStation.map((p) => normalizeDbmToScore(p.interpolatedDbm)))
      : 0;
    const overallDbm = scoreToDbm(overallScore);
    const overallQuality = classifySignal(overallDbm);

    const strongEnough = perStation.filter((p) => p.interpolatedDbm >= this.options.triangulationDbmThreshold).length;
    const minRequired = Math.max(
      this.options.minVisibleStationsForTriangulation,
      Math.ceil(perStation.length * this.options.majorityRatio),
    );

    const canTriangulate = strongEnough >= minRequired;
    const triangulationStatus = !canTriangulate
      ? (strongEnough > 0 ? 'degraded' : 'unavailable')
      : 'available';

    return {
      target,
      perStation,
      overallScore,
      overallQuality,
      triangulationStatus,
      canTriangulate,
    };
  }

  private predictBaseline(target: GeoPoint, station: StationVisibility): number {
    const calibration = this.calibrations.get(station.stationId);
    const exponent = calibration?.pathLossExponent ?? this.options.pathLossExponent;
    const refDistance = calibration?.referenceDistanceM ?? this.options.referenceDistanceM;

    const d = Math.max(haversineDistanceMeters(target, station.location), refDistance);

    // fallback если калибровки пока нет
    const intercept = calibration?.intercept ?? -42;
    return intercept - 10 * exponent * Math.log10(d / refDistance);
  }

  private interpolateResidual(
    target: GeoPoint,
    station: StationVisibility,
    stationSamples: SignalSample[],
    baselineAtTarget: number,
  ): number {
    const nearby = this.selectNearbySamples(target, stationSamples);
    if (nearby.length === 0) {
      return baselineAtTarget;
    }

    let weightedResidual = 0;
    let weightSum = 0;

    for (const sample of nearby) {
      const distanceToTarget = Math.max(haversineDistanceMeters(target, sample.point), 1);
      const sampleBaseline = this.predictBaseline(sample.point, station);
      const residual = sample.dbm - sampleBaseline;
      const weight = 1 / Math.pow(distanceToTarget, this.options.idwPower);

      weightedResidual += residual * weight;
      weightSum += weight;
    }

    if (weightSum === 0) {
      return baselineAtTarget;
    }

    return baselineAtTarget + weightedResidual / weightSum;
  }

  private selectNearbySamples(target: GeoPoint, stationSamples: SignalSample[]): SignalSample[] {
    return stationSamples
      .map((sample) => ({
        sample,
        distance: haversineDistanceMeters(target, sample.point),
      }))
      .filter((x) => x.distance <= this.options.nearbyRadiusM)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, this.options.maxNearbySamples)
      .map((x) => x.sample);
  }
}

function classifySignal(dbm: number): SignalQuality {
  if (dbm >= -75) return 'excellent';
  if (dbm >= -90) return 'good';
  if (dbm >= -102) return 'fair';
  if (dbm >= -112) return 'poor';
  return 'unusable';
}

function normalizeDbmToScore(dbm: number): number {
  const min = -120;
  const max = -65;
  const clamped = Math.min(max, Math.max(min, dbm));
  return (clamped - min) / (max - min);
}

function scoreToDbm(score: number): number {
  const min = -120;
  const max = -65;
  return min + score * (max - min);
}

function groupBy<T, K>(arr: T[], getKey: (v: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of arr) {
    const key = getKey(item);
    const bucket = map.get(key);
    if (bucket) {
      bucket.push(item);
    } else {
      map.set(key, [item]);
    }
  }
  return map;
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function haversineDistanceMeters(a: GeoPoint, b: GeoPoint): number {
  const earthRadius = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);

  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}
