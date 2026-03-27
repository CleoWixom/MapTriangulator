import type { CoverageConfig } from '../../config/coverage';
import type { BaseStation, RadioTech } from '../../types/baseStation';

const DESCRIPTION_RADIUS_RE = /~\s*(\d+(?:[.,]\d+)?)\s*\(m\)/i;

export interface CoverageFeatureProperties {
  stationId: string;
  mcc: number;
  mnc: number;
  tech: RadioTech;
  radius: number;
  fill: string;
  fillOpacity: number;
}

export interface CoverageFeature {
  type: 'Feature';
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  properties: CoverageFeatureProperties;
}

export interface CoverageLayerData {
  type: 'FeatureCollection';
  features: CoverageFeature[];
}

export function parseRadiusFromDescription(description?: string): number | undefined {
  if (!description) return undefined;

  const match = description.match(DESCRIPTION_RADIUS_RE);
  if (!match?.[1]) return undefined;

  const parsed = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
}

export function resolveCoverageRadius(station: BaseStation, config: CoverageConfig): number {
  const parsedRadius = parseRadiusFromDescription(station.description);
  if (parsedRadius) {
    return parsedRadius;
  }

  return config.tech[station.tech].radiusMeters;
}

function createCirclePolygon(
  lon: number,
  lat: number,
  radiusMeters: number,
  segments = 64,
): number[][][] {
  const earthRadius = 6_378_137;
  const dLat = radiusMeters / earthRadius;
  const dLon = radiusMeters / (earthRadius * Math.cos((Math.PI * lat) / 180));

  const ring: number[][] = [];

  for (let i = 0; i <= segments; i += 1) {
    const theta = (2 * Math.PI * i) / segments;
    const pointLat = lat + (dLat * Math.sin(theta) * 180) / Math.PI;
    const pointLon = lon + (dLon * Math.cos(theta) * 180) / Math.PI;
    ring.push([pointLon, pointLat]);
  }

  return [ring];
}

export function buildCoverageLayer(
  stations: BaseStation[],
  config: CoverageConfig,
  isVisible: boolean,
): CoverageLayerData {
  if (!isVisible) {
    return { type: 'FeatureCollection', features: [] };
  }

  const features = stations.map((station): CoverageFeature => {
    const radius = resolveCoverageRadius(station, config);

    return {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: createCirclePolygon(station.lon, station.lat, radius),
      },
      properties: {
        stationId: station.id,
        mcc: station.mcc,
        mnc: station.mnc,
        tech: station.tech,
        radius,
        fill: config.tech[station.tech].color,
        fillOpacity: config.opacity,
      },
    };
  });

  return {
    type: 'FeatureCollection',
    features,
  };
}
