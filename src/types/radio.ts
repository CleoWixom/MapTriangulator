export type Dbm = number;

export interface GeoPoint {
  lat: number;
  lon: number;
}

/**
 * Наблюдение сигнала, импортированное из KML/drive-трассы.
 */
export interface SignalSample {
  point: GeoPoint;
  stationId: string;
  dbm: Dbm;
  timestamp?: string;
  sourceFile?: string;
}

export interface StationVisibility {
  stationId: string;
  location: GeoPoint;
}

export interface SignalPrediction {
  stationId: string;
  baselineDbm: Dbm;
  interpolatedDbm: Dbm;
  quality: SignalQuality;
  nearbySamplesUsed: number;
}

export type SignalQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'unusable';

export type TriangulationStatus = 'available' | 'degraded' | 'unavailable';

export interface SignalForecast {
  target: GeoPoint;
  perStation: SignalPrediction[];
  overallScore: number;
  overallQuality: SignalQuality;
  triangulationStatus: TriangulationStatus;
  canTriangulate: boolean;
}

export interface PyOperatorGroupDto {
  mcc: number;
  mnc: number;
}

export interface PyCellSiteDto {
  name: string;
  radio: string;
  lat: number;
  lon: number;
  operator?: PyOperatorGroupDto;
  lac?: number;
  cid?: string;
  rnc?: number;
  psc?: number;
  station_id?: string;
  style_url?: string;
  distance_m?: number;
  accuracy?: number;
  change_type?: string;
  timestamp?: string;
  description?: string;
}

export interface PySignalSampleDto {
  dbm: number;
  lat: number;
  lon: number;
  operator?: PyOperatorGroupDto;
  lac?: number;
  cid?: string;
  rnc?: number;
  psc?: number;
  station_id?: string;
  style_url?: string;
  accuracy?: number;
  change_type?: string;
  timestamp?: string;
  description?: string;
}

export interface KmlIngestionPayloadDto {
  schema_version: string;
  cell_sites: PyCellSiteDto[];
  signal_samples: PySignalSampleDto[];
  warnings: string[];
}
