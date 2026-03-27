export type RadioTech = 'LTE' | 'GSM' | 'WCDMA' | 'UNKNOWN';
export type CoverageRadiusSource = 'measured' | 'modeled' | 'missing';

export interface BaseStation {
  id: string;
  lat: number;
  lon: number;
  mcc?: number;
  mnc?: number;
  tech?: string;
  description?: string;
  measuredRadiusMeters?: number;
  modeledRadiusMeters?: number;
  modeledRadiusValidated?: boolean;
}

export interface RadiusStyle {
  color: string;
  opacity: number;
}

export interface CoverageCircle {
  stationId: string;
  center: [number, number];
  radiusMeters: number;
  radiusSource: Exclude<CoverageRadiusSource, 'missing'>;
  tech: RadioTech;
  mcc?: number;
  mnc?: number;
  style: RadiusStyle;
}
