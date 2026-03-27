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

export type ParameterSource = 'measurement' | 'config' | 'estimate';

export interface ParameterAuditEntry {
  parameter: string;
  value: number | string;
  source: ParameterSource;
  stationId?: string;
  configVersion?: string;
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
  parameterAuditTrail: ParameterAuditEntry[];
}

export interface ErrorModelUncertaintyPriors {
  minRadiusSigmaMeters: number;
  fallbackRadiusSigmaMeters: number;
  fallbackRadialSigmaMeters: number;
  degenerateCovarianceMeters2: number;
  degenerateGdop: number;
}

export interface ErrorModelConfidenceWeights {
  gdopScale: number;
  radialSigmaScale: number;
  geometryWeight: number;
  radialWeight: number;
  defaultSignalWeight: number;
  minSignalWeight: number;
  maxSignalWeight: number;
}

export interface TriangulationModelCalibration {
  version: string;
  pathLossExponent: number;
  uncertaintyPriors: ErrorModelUncertaintyPriors;
  confidenceWeights: ErrorModelConfidenceWeights;
  chi2Ellipse95_2d: number;
  strictValidation: boolean;
}

const EARTH_RADIUS_M = 6_371_000;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toStationId(m: CellMeasurement): string {
  return `${m.mcc}/${m.mnc}/${m.lac}/${m.cid}`;
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

function weightFromSignal(
  signalDbm: number | undefined,
  confidenceWeights: ErrorModelConfidenceWeights,
): number {
  if (signalDbm === undefined || Number.isNaN(signalDbm)) {
    return confidenceWeights.defaultSignalWeight;
  }

  // [-120..-50] dBm -> [minSignalWeight..maxSignalWeight]
  const normalized = (signalDbm + 120) / 70;
  return clamp(
    confidenceWeights.minSignalWeight
      + normalized * (confidenceWeights.maxSignalWeight - confidenceWeights.minSignalWeight),
    confidenceWeights.minSignalWeight,
    confidenceWeights.maxSignalWeight,
  );
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
  calibration: TriangulationModelCalibration,
  auditTrail: ParameterAuditEntry[],
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

    const stationId = toStationId(m);
    const baseWeight = m.weight ?? weightFromSignal(m.signalDbm, calibration.confidenceWeights);
    const weightSource: ParameterSource = m.weight !== undefined
      ? 'measurement'
      : m.signalDbm !== undefined
        ? 'estimate'
        : 'config';

    const sigmaSource: ParameterSource = m.radiusUncertaintyMeters !== undefined ? 'measurement' : 'config';
    const sigma = Math.max(
      m.radiusUncertaintyMeters ?? calibration.uncertaintyPriors.fallbackRadiusSigmaMeters,
      calibration.uncertaintyPriors.minRadiusSigmaMeters,
    );

    if (calibration.strictValidation && (m.weight === undefined || m.radiusUncertaintyMeters === undefined)) {
      throw new Error(
        `Strict validation: missing per-measurement calibration for station ${stationId} (weight or radius uncertainty).`,
      );
    }

    auditTrail.push(
      {
        parameter: 'observation_weight',
        value: Number(baseWeight.toFixed(6)),
        source: weightSource,
        stationId,
        configVersion: calibration.version,
      },
      {
        parameter: 'radius_sigma_m',
        value: Number(sigma.toFixed(3)),
        source: sigmaSource,
        stationId,
        configVersion: calibration.version,
      },
    );

    const w = Math.max(baseWeight / (sigma * sigma), 1e-8);

    a11 += w * ux * ux;
    a12 += w * ux * uy;
    a22 += w * uy * uy;
  }

  const inv = invert2x2(a11, a12, a12, a22);
  if (!inv) {
    // Degenerate geometry (e.g. collinear stations)
    auditTrail.push({
      parameter: 'degenerate_geometry_fallback',
      value: calibration.uncertaintyPriors.degenerateCovarianceMeters2,
      source: 'config',
      configVersion: calibration.version,
    });

    return {
      covXX: calibration.uncertaintyPriors.degenerateCovarianceMeters2,
      covXY: 0,
      covYY: calibration.uncertaintyPriors.degenerateCovarianceMeters2,
      gdop: calibration.uncertaintyPriors.degenerateGdop,
    };
  }

  const [i11, i12, i21, i22] = inv;
  const trace = i11 + i22;
  const gdop = Math.sqrt(Math.max(trace, 0));

  return { covXX: i11, covXY: (i12 + i21) * 0.5, covYY: i22, gdop };
}

function computeRadialSigma(
  measurements: CellMeasurement[],
  calibration: TriangulationModelCalibration,
  auditTrail: ParameterAuditEntry[],
): number {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const m of measurements) {
    const stationId = toStationId(m);
    const derivedWeight = m.weight ?? weightFromSignal(m.signalDbm, calibration.confidenceWeights);
    const weightSource: ParameterSource = m.weight !== undefined
      ? 'measurement'
      : m.signalDbm !== undefined
        ? 'estimate'
        : 'config';

    let sigmaRadiusSource: ParameterSource = 'measurement';
    let sigmaRadius = m.radiusUncertaintyMeters;

    if (sigmaRadius === undefined) {
      sigmaRadiusSource = 'config';
      sigmaRadius = calibration.uncertaintyPriors.fallbackRadiusSigmaMeters;
    }

    if (calibration.strictValidation && m.radiusUncertaintyMeters === undefined) {
      throw new Error(`Strict validation: missing radius uncertainty for station ${stationId}.`);
    }

    const sigmaAccuracy = m.accuracyMeters ?? 0;
    if (calibration.strictValidation && m.accuracyMeters === undefined) {
      throw new Error(`Strict validation: missing accuracy metric for station ${stationId}.`);
    }

    const sigma = Math.sqrt(sigmaRadius * sigmaRadius + sigmaAccuracy * sigmaAccuracy);

    auditTrail.push(
      {
        parameter: 'radial_sigma_weight',
        value: Number(derivedWeight.toFixed(6)),
        source: weightSource,
        stationId,
        configVersion: calibration.version,
      },
      {
        parameter: 'radial_sigma_radius_component_m',
        value: Number(sigmaRadius.toFixed(3)),
        source: sigmaRadiusSource,
        stationId,
        configVersion: calibration.version,
      },
      {
        parameter: 'radial_sigma_accuracy_component_m',
        value: Number(sigmaAccuracy.toFixed(3)),
        source: m.accuracyMeters !== undefined ? 'measurement' : 'estimate',
        stationId,
        configVersion: calibration.version,
      },
    );

    weightedSum += derivedWeight * sigma * sigma;
    totalWeight += derivedWeight;
  }

  if (totalWeight <= 1e-8) {
    if (calibration.strictValidation) {
      throw new Error('Strict validation: no valid weighted measurements for radial sigma computation.');
    }

    auditTrail.push({
      parameter: 'fallback_radial_sigma_m',
      value: calibration.uncertaintyPriors.fallbackRadialSigmaMeters,
      source: 'config',
      configVersion: calibration.version,
    });
    return calibration.uncertaintyPriors.fallbackRadialSigmaMeters;
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
  calibration: TriangulationModelCalibration,
): ErrorAssessment {
  if (measurements.length < 2) {
    throw new Error('At least 2 cell measurements are required for error assessment.');
  }

  if (!calibration.version || !Number.isFinite(calibration.pathLossExponent)) {
    throw new Error('Calibration object is required and must include version and path-loss exponent.');
  }

  const auditTrail: ParameterAuditEntry[] = [
    {
      parameter: 'path_loss_exponent',
      value: calibration.pathLossExponent,
      source: 'config',
      configVersion: calibration.version,
    },
    {
      parameter: 'chi2_ellipse_95_2d',
      value: calibration.chi2Ellipse95_2d,
      source: 'config',
      configVersion: calibration.version,
    },
  ];

  const obsCov = buildObservationCovariance(estimate, measurements, calibration, auditTrail);
  const geometricSigmaMeters = Math.sqrt(Math.max((obsCov.covXX + obsCov.covYY) * 0.5, 0));
  const radialSigmaMeters = computeRadialSigma(measurements, calibration, auditTrail);

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
    semiMajorMeters: Math.sqrt(lambdaMax * calibration.chi2Ellipse95_2d),
    semiMinorMeters: Math.sqrt(lambdaMin * calibration.chi2Ellipse95_2d),
    orientationDeg: eigen.theta * RAD_TO_DEG,
    confidence: 0.95,
    contour: buildContour(
      estimate,
      Math.sqrt(lambdaMax * calibration.chi2Ellipse95_2d),
      Math.sqrt(lambdaMin * calibration.chi2Ellipse95_2d),
      eigen.theta,
    ),
  };

  const geometryConfidence = 1 / (1 + obsCov.gdop / calibration.confidenceWeights.gdopScale);
  const radialConfidence = 1 / (1 + radialSigmaMeters / calibration.confidenceWeights.radialSigmaScale);
  const confidenceScore = clamp(
    calibration.confidenceWeights.geometryWeight * geometryConfidence
      + calibration.confidenceWeights.radialWeight * radialConfidence,
    0,
    1,
  );

  return {
    geometricGdop: obsCov.gdop,
    geometricSigmaMeters,
    radialSigmaMeters,
    totalSigmaMeters,
    circularError50Meters,
    circularError95Meters,
    ellipse95,
    confidenceScore,
    parameterAuditTrail: auditTrail,
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
