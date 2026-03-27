export type RadioTech = 'LTE' | 'GSM' | 'WCDMA' | 'UNKNOWN';

export interface BaseStation {
  id: string;
  lat: number;
  lon: number;
  mcc?: number;
  mnc?: number;
  tech?: string;
  description?: string;
}

export interface RadiusStyle {
  color: string;
  opacity: number;
}

export interface CoverageCircle {
  stationId: string;
  center: [number, number];
  radiusMeters: number;
  tech: RadioTech;
  mcc?: number;
  mnc?: number;
  style: RadiusStyle;
}
