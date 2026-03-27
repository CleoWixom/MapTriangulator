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

const RADIUS_FROM_DESCRIPTION_REGEX = /~\s*(\d+(?:[.,]\d+)?)\s*\((?:m|meter|meters)\)/i;

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

export const extractRadiusFromDescription = (
  description?: string,
): number | undefined => {
  if (!description) {
    return undefined;
  }

  const match = description.match(RADIUS_FROM_DESCRIPTION_REGEX);
  if (!match) {
    return undefined;
  }

  const normalized = match[1].replace(',', '.');
  const parsed = Number.parseFloat(normalized);

  return Number.isFinite(parsed) ? parsed : undefined;
};

export const resolveCoverageRadius = (
  station: BaseStation,
  config: CoverageConfig = DEFAULT_COVERAGE_CONFIG,
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

  const fromDescription = extractRadiusFromDescription(station.description);
  if (typeof fromDescription === 'number') {
    return {
      radiusMeters: fromDescription,
      radiusSource: 'modeled',
    };
  }

  if (config.enableLegacyFallbackRadii) {
    const tech = normalizeTech(station.tech);
    return {
      radiusMeters: config.radiusFallbackByTech[tech].radiusMeters,
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
  config: CoverageConfig = DEFAULT_COVERAGE_CONFIG,
): CoverageRadiusQuality => {
  const totalStations = stations.length;
  const withRealRadius = stations.reduce((count, station) => {
    const { radiusSource } = resolveCoverageRadius(station, config);
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
      const { radiusMeters, radiusSource } = resolveCoverageRadius(station, config);
      if (typeof radiusMeters !== 'number' || radiusSource === 'missing') {
        return undefined;
      }

      const style = config.radiusFallbackByTech[tech].style;

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
