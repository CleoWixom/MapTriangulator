export type Technology = '2G' | '3G' | '4G' | '5G' | 'LTE' | 'NR' | 'UNKNOWN';

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface Sector {
  id: string;
  stationId: string;
  azimuthDeg?: number;
  beamwidthDeg?: number;
  coverageRadiusMeters: number;
  technology: Technology;
  /**
   * Signal quality in range [0..1].
   * Example: normalized RSRP/RSRQ/SINR quality index.
   */
  signalQuality: number;
  location: GeoPoint;
}

export interface TriangulationInput {
  point: GeoPoint;
  sectors: Sector[];
}

export interface ParticipatingCell {
  sectorId: string;
  stationId: string;
  technology: Technology;
  signalQuality: number;
  distanceMeters: number;
  weightedScore: number;
}

export interface TriangulationResult {
  triangulation_possible: 'yes' | 'no';
  suitable_station_count: number;
  participating_cells: ParticipatingCell[];
  min_required_stations: 3;
  recommended_stations_for_stability: 4;
}

const TECHNOLOGY_WEIGHT: Record<Technology, number> = {
  UNKNOWN: 0.5,
  '2G': 0.6,
  '3G': 0.75,
  '4G': 0.95,
  LTE: 0.95,
  '5G': 1.15,
  NR: 1.15,
};

const EARTH_RADIUS_M = 6_371_000;

export function calculateTriangulation(input: TriangulationInput): TriangulationResult {
  const coveredSectors: ParticipatingCell[] = input.sectors
    .map((sector) => {
      const distanceMeters = haversineMeters(input.point, sector.location);
      if (distanceMeters > sector.coverageRadiusMeters) {
        return null;
      }

      const normalizedQuality = clamp01(sector.signalQuality);
      const technologyWeight = TECHNOLOGY_WEIGHT[sector.technology] ?? TECHNOLOGY_WEIGHT.UNKNOWN;

      return {
        sectorId: sector.id,
        stationId: sector.stationId,
        technology: sector.technology,
        signalQuality: normalizedQuality,
        distanceMeters,
        weightedScore: normalizedQuality * technologyWeight,
      } satisfies ParticipatingCell;
    })
    .filter((item): item is ParticipatingCell => Boolean(item))
    .sort((a, b) => b.weightedScore - a.weightedScore);

  const suitableStations = new Set(coveredSectors.map((sector) => sector.stationId));
  const suitableStationCount = suitableStations.size;

  return {
    triangulation_possible: suitableStationCount >= 3 ? 'yes' : 'no',
    suitable_station_count: suitableStationCount,
    participating_cells: coveredSectors,
    min_required_stations: 3,
    recommended_stations_for_stability: 4,
  };
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

function haversineMeters(from: GeoPoint, to: GeoPoint): number {
  const dLat = toRadians(to.lat - from.lat);
  const dLon = toRadians(to.lon - from.lon);

  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_M * c;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
