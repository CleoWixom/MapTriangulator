import type {
  BaseStation,
  CoverageCircle,
  CoverageRadiusSource,
  RadioTech,
} from '../../types/cells';
import {
  DEFAULT_COVERAGE_CONFIG,
  type CoverageConfig,
} from '../config/coverage';

export const normalizeTech = (rawTech?: string): RadioTech => {
  const tech = (rawTech || '').trim().toUpperCase();

  if (tech.includes('LTE')) {
    return 'LTE';
  }

  if (tech.includes('WCDMA') || tech.includes('UMTS')) {
    return 'WCDMA';
  }

  if (tech.includes('GSM') || tech.includes('2G')) {
    return 'GSM';
  }

  return 'UNKNOWN';
};

export const resolveCoverageRadius = (
  station: BaseStation,
): {
  radiusMeters?: number;
  radiusSource: CoverageRadiusSource;
} => {
  if (
    typeof station.measuredRadiusMeters === 'number' &&
    Number.isFinite(station.measuredRadiusMeters)
  ) {
    return {
      radiusMeters: station.measuredRadiusMeters,
      radiusSource: 'measured',
    };
  }

  if (
    typeof station.modeledRadiusMeters === 'number' &&
    Number.isFinite(station.modeledRadiusMeters) &&
    station.modeledRadiusValidated
  ) {
    return {
      radiusMeters: station.modeledRadiusMeters,
      radiusSource: 'modeled',
    };
  }

  return {
    radiusSource: 'missing',
  };
};

export interface CoverageRadiusQuality {
  totalStations: number;
  withRealRadius: number;
  missingRadius: number;
  missingShare: number;
}

export const calculateCoverageRadiusQuality = (
  stations: BaseStation[],
): CoverageRadiusQuality => {
  const totalStations = stations.length;
  const withRealRadius = stations.reduce((count, station) => {
    const { radiusSource } = resolveCoverageRadius(station);
    return radiusSource === 'missing' ? count : count + 1;
  }, 0);

  const missingRadius = totalStations - withRealRadius;
  const missingShare = totalStations > 0 ? missingRadius / totalStations : 0;

  return {
    totalStations,
    withRealRadius,
    missingRadius,
    missingShare,
  };
};

export const buildCoverageCircles = (
  stations: BaseStation[],
  config: CoverageConfig = DEFAULT_COVERAGE_CONFIG,
): CoverageCircle[] => {
  if (!config.showCoverage) {
    return [];
  }

  return stations
    .map((station): CoverageCircle | undefined => {
      const tech = normalizeTech(station.tech);
      const { radiusMeters, radiusSource } = resolveCoverageRadius(station);
      if (typeof radiusMeters !== 'number' || radiusSource === 'missing') {
        return undefined;
      }

      const style = config.radiusStyleByTech[tech];

      return {
        stationId: station.id,
        center: [station.lat, station.lon],
        radiusMeters,
        radiusSource,
        tech,
        mcc: station.mcc,
        mnc: station.mnc,
        style,
      };
    })
    .filter((circle): circle is CoverageCircle => Boolean(circle))
    .filter(
      (circle) =>
        circle.radiusMeters >= config.minRadiusMeters &&
        circle.radiusMeters <= config.maxRadiusMeters,
    );
};
