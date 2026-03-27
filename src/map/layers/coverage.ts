import type { BaseStation, CoverageCircle, RadioTech } from '../../types/cells';
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
): number => {
  const fromDescription = extractRadiusFromDescription(station.description);
  if (typeof fromDescription === 'number') {
    return fromDescription;
  }

  const tech = normalizeTech(station.tech);
  return config.radiusFallbackByTech[tech].radiusMeters;
};

export const buildCoverageCircles = (
  stations: BaseStation[],
  config: CoverageConfig = DEFAULT_COVERAGE_CONFIG,
): CoverageCircle[] => {
  if (!config.showCoverage) {
    return [];
  }

  return stations
    .map((station): CoverageCircle => {
      const tech = normalizeTech(station.tech);
      const radiusMeters = resolveCoverageRadius(station, config);
      const style = config.radiusFallbackByTech[tech].style;

      return {
        stationId: station.id,
        center: [station.lat, station.lon],
        radiusMeters,
        tech,
        mcc: station.mcc,
        mnc: station.mnc,
        style,
      };
    })
    .filter(
      (circle) =>
        circle.radiusMeters >= config.minRadiusMeters &&
        circle.radiusMeters <= config.maxRadiusMeters,
    );
};
