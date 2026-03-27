import { StationIdComponents } from '../types/baseStation';
import {
  KmlIngestionPayloadDto,
  PyCellSiteDto,
  PySignalSampleDto,
  SignalSample,
  StationVisibility,
} from '../types/radio';

export class IngestionValidationError extends Error {
  readonly details: string[];

  constructor(details: string[]) {
    super(`Ingestion validation failed: ${details.join('; ')}`);
    this.name = 'IngestionValidationError';
    this.details = details;
  }
}

export interface IngestedRadioData {
  stations: StationVisibility[];
  samples: SignalSample[];
}

export function normalizeStationId(parts: StationIdComponents): string {
  const cid = String(parts.cid ?? '').trim();
  if (!cid) {
    throw new IngestionValidationError(['stationId normalization failed: CID is empty']);
  }

  return `${parts.mcc}-${parts.mnc}-${parts.lac}-${cid}-${parts.psc}`;
}

export function ingestRadioPayload(payload: KmlIngestionPayloadDto): IngestedRadioData {
  if (!payload || payload.schema_version !== '1.0.0') {
    throw new IngestionValidationError(['Unsupported schema_version. Expected 1.0.0']);
  }

  return {
    stations: payload.cell_sites.map((cellSite, index) => mapCellSite(cellSite, index)),
    samples: payload.signal_samples.map((sample, index) => mapSignalSample(sample, index)),
  };
}

export function mapCellSite(cellSite: PyCellSiteDto, index = 0): StationVisibility {
  const prefix = `cell_sites[${index}]`;
  const stationId = resolveStationId(cellSite, prefix);
  const point = validateGeoPoint(prefix, cellSite.lat, cellSite.lon);

  return {
    stationId,
    location: point,
  };
}

export function mapSignalSample(sample: PySignalSampleDto, index = 0): SignalSample {
  const prefix = `signal_samples[${index}]`;
  const stationId = resolveStationId(sample, prefix);
  const point = validateGeoPoint(prefix, sample.lat, sample.lon);

  if (!Number.isFinite(sample.dbm)) {
    throw new IngestionValidationError([`${prefix}.dbm is required and must be a finite number`]);
  }

  return {
    point,
    stationId,
    dbm: sample.dbm,
    timestamp: sample.timestamp,
  };
}

function resolveStationId(
  value: Pick<PyCellSiteDto, 'station_id' | 'operator' | 'lac' | 'cid' | 'psc'>,
  prefix: string,
): string {
  if (value.station_id && value.station_id.trim()) {
    return value.station_id;
  }

  if (!value.operator) {
    throw new IngestionValidationError([`${prefix}.operator is required to build stationId`]);
  }
  if (!Number.isInteger(value.lac)) {
    throw new IngestionValidationError([`${prefix}.lac is required to build stationId`]);
  }
  if (!value.cid || !value.cid.trim()) {
    throw new IngestionValidationError([`${prefix}.cid is required to build stationId`]);
  }
  if (!Number.isInteger(value.psc)) {
    throw new IngestionValidationError([`${prefix}.psc is required to build stationId`]);
  }

  return normalizeStationId({
    mcc: value.operator.mcc,
    mnc: value.operator.mnc,
    lac: value.lac as number,
    cid: value.cid,
    psc: value.psc as number,
  });
}

function validateGeoPoint(prefix: string, lat: number, lon: number): { lat: number; lon: number } {
  const errors: string[] = [];

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    errors.push(`${prefix}.lat is required and must be in [-90, 90]`);
  }

  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    errors.push(`${prefix}.lon is required and must be in [-180, 180]`);
  }

  if (errors.length > 0) {
    throw new IngestionValidationError(errors);
  }

  return { lat, lon };
}
