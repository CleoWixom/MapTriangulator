export type CellTechnology = 'GSM' | 'UMTS' | 'LTE' | 'NR' | string;

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface CellMeasurement {
  mcc: number;
  mnc: number;
  lac: number;
  cid: number;
  technology: CellTechnology;
  station: GeoPoint;
  radiusMeters: number;
  /**
   * One-sigma uncertainty of radius estimate from radio model.
   */
  radiusUncertaintyMeters?: number;
  /**
   * Optional ACCURACY field from a sample record.
   */
  accuracyMeters?: number;
  /**
   * Raw RF level (dBm).
   */
  signalDbm?: number;
  /**
   * Optional normalized weight [0..1], if not provided it is derived from signalDbm.
   */
  weight?: number;
}

export interface ErrorEllipse {
  center: GeoPoint;
  semiMajorMeters: number;
  semiMinorMeters: number;
  orientationDeg: number;
  confidence: number;
  contour: GeoPoint[];
}

export interface ErrorAssessment {
  geometricGdop: number;
  geometricSigmaMeters: number;
  radialSigmaMeters: number;
  totalSigmaMeters: number;
  circularError50Meters: number;
  circularError95Meters: number;
  ellipse95: ErrorEllipse;
  confidenceScore: number;
}

const EARTH_RADIUS_M = 6_371_000;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const CHI2_95_2D = 5.991; // 2 DOF

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toLocalMeters(origin: GeoPoint, point: GeoPoint): { x: number; y: number } {
  const meanLat = (origin.lat + point.lat) * 0.5 * DEG_TO_RAD;
  const dLat = (point.lat - origin.lat) * DEG_TO_RAD;
  const dLon = (point.lon - origin.lon) * DEG_TO_RAD;

  const y = dLat * EARTH_RADIUS_M;
  const x = dLon * EARTH_RADIUS_M * Math.cos(meanLat);
  return { x, y };
}

function fromLocalMeters(origin: GeoPoint, x: number, y: number): GeoPoint {
  const lat = origin.lat + (y / EARTH_RADIUS_M) * RAD_TO_DEG;
  const lon = origin.lon + (x / (EARTH_RADIUS_M * Math.cos(origin.lat * DEG_TO_RAD))) * RAD_TO_DEG;
  return { lat, lon };
}

function weightFromSignal(signalDbm?: number): number {
  if (signalDbm === undefined || Number.isNaN(signalDbm)) {
    return 0.5;
  }

  // [-120..-50] dBm -> [0.1..1]
  const normalized = (signalDbm + 120) / 70;
  return clamp(0.1 + normalized * 0.9, 0.1, 1);
}

function invert2x2(a11: number, a12: number, a21: number, a22: number): [number, number, number, number] | null {
  const det = a11 * a22 - a12 * a21;
  if (Math.abs(det) < 1e-9) {
    return null;
  }

  const invDet = 1 / det;
  return [a22 * invDet, -a12 * invDet, -a21 * invDet, a11 * invDet];
}

function eigen2x2Symmetric(a: number, b: number, d: number): { l1: number; l2: number; theta: number } {
  // Matrix [[a, b], [b, d]]
  const trace = a + d;
  const delta = Math.sqrt(Math.max((a - d) * (a - d) + 4 * b * b, 0));
  const l1 = 0.5 * (trace + delta);
  const l2 = 0.5 * (trace - delta);

  // Orientation of first eigenvector
  const theta = 0.5 * Math.atan2(2 * b, a - d);
  return { l1, l2, theta };
}

function buildObservationCovariance(
  estimate: GeoPoint,
  measurements: CellMeasurement[],
): { covXX: number; covXY: number; covYY: number; gdop: number } {
  let a11 = 0;
  let a12 = 0;
  let a22 = 0;

  for (const m of measurements) {
    const rel = toLocalMeters(estimate, m.station);
    const distance = Math.hypot(rel.x, rel.y);
    if (distance < 1) {
      continue;
    }

    const ux = rel.x / distance;
    const uy = rel.y / distance;

    const baseWeight = m.weight ?? weightFromSignal(m.signalDbm);
    const sigma = Math.max(m.radiusUncertaintyMeters ?? 150, 10);
    const w = Math.max(baseWeight / (sigma * sigma), 1e-8);

    a11 += w * ux * ux;
    a12 += w * ux * uy;
    a22 += w * uy * uy;
  }

  const inv = invert2x2(a11, a12, a12, a22);
  if (!inv) {
    // Degenerate geometry (e.g. collinear stations)
    return {
      covXX: 1_000_000,
      covXY: 0,
      covYY: 1_000_000,
      gdop: 1_000,
    };
  }

  const [i11, i12, i21, i22] = inv;
  const trace = i11 + i22;
  const gdop = Math.sqrt(Math.max(trace, 0));

  return { covXX: i11, covXY: (i12 + i21) * 0.5, covYY: i22, gdop };
}

function computeRadialSigma(measurements: CellMeasurement[]): number {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const m of measurements) {
    const derivedWeight = m.weight ?? weightFromSignal(m.signalDbm);
    const sigmaRadius = m.radiusUncertaintyMeters ?? Math.max(m.radiusMeters * 0.15, 50);
    const sigmaAccuracy = m.accuracyMeters ?? 0;
    const sigma = Math.sqrt(sigmaRadius * sigmaRadius + sigmaAccuracy * sigmaAccuracy);

    weightedSum += derivedWeight * sigma * sigma;
    totalWeight += derivedWeight;
  }

  if (totalWeight <= 1e-8) {
    return 200;
  }

  return Math.sqrt(weightedSum / totalWeight);
}

function buildContour(
  center: GeoPoint,
  semiMajorMeters: number,
  semiMinorMeters: number,
  angleRad: number,
  points = 72,
): GeoPoint[] {
  const contour: GeoPoint[] = [];
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);

  for (let i = 0; i <= points; i += 1) {
    const t = (i / points) * Math.PI * 2;
    const ex = semiMajorMeters * Math.cos(t);
    const ey = semiMinorMeters * Math.sin(t);

    const x = ex * c - ey * s;
    const y = ex * s + ey * c;
    contour.push(fromLocalMeters(center, x, y));
  }

  return contour;
}

export function assessTriangulationError(
  estimate: GeoPoint,
  measurements: CellMeasurement[],
): ErrorAssessment {
  if (measurements.length < 2) {
    throw new Error('At least 2 cell measurements are required for error assessment.');
  }

  const obsCov = buildObservationCovariance(estimate, measurements);
  const geometricSigmaMeters = Math.sqrt(Math.max((obsCov.covXX + obsCov.covYY) * 0.5, 0));
  const radialSigmaMeters = computeRadialSigma(measurements);

  // Total covariance: geometry covariance + isotropic radial covariance.
  const totalCovXX = obsCov.covXX + radialSigmaMeters * radialSigmaMeters;
  const totalCovYY = obsCov.covYY + radialSigmaMeters * radialSigmaMeters;
  const totalCovXY = obsCov.covXY;

  const eigen = eigen2x2Symmetric(totalCovXX, totalCovXY, totalCovYY);
  const lambdaMax = Math.max(eigen.l1, eigen.l2, 1);
  const lambdaMin = Math.max(Math.min(eigen.l1, eigen.l2), 1);

  const totalSigmaMeters = Math.sqrt((lambdaMax + lambdaMin) * 0.5);
  const circularError50Meters = 1.1774 * totalSigmaMeters;
  const circularError95Meters = 2.4477 * totalSigmaMeters;

  const ellipse95: ErrorEllipse = {
    center: estimate,
    semiMajorMeters: Math.sqrt(lambdaMax * CHI2_95_2D),
    semiMinorMeters: Math.sqrt(lambdaMin * CHI2_95_2D),
    orientationDeg: eigen.theta * RAD_TO_DEG,
    confidence: 0.95,
    contour: buildContour(
      estimate,
      Math.sqrt(lambdaMax * CHI2_95_2D),
      Math.sqrt(lambdaMin * CHI2_95_2D),
      eigen.theta,
    ),
  };

  const geometryConfidence = 1 / (1 + obsCov.gdop / 8);
  const radialConfidence = 1 / (1 + radialSigmaMeters / 300);
  const confidenceScore = clamp(0.65 * geometryConfidence + 0.35 * radialConfidence, 0, 1);

  return {
    geometricGdop: obsCov.gdop,
    geometricSigmaMeters,
    radialSigmaMeters,
    totalSigmaMeters,
    circularError50Meters,
    circularError95Meters,
    ellipse95,
    confidenceScore,
  };
}

export function toGeoJsonErrorContour(assessment: ErrorAssessment): GeoJSON.Feature<GeoJSON.Polygon> {
  return {
    type: 'Feature',
    properties: {
      confidence: assessment.ellipse95.confidence,
      ce95: assessment.circularError95Meters,
      confidenceScore: assessment.confidenceScore,
    },
    geometry: {
      type: 'Polygon',
      coordinates: [assessment.ellipse95.contour.map((p) => [p.lon, p.lat])],
    },
  };
}
