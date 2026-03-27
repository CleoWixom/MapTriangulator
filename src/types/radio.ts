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
