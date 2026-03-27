export type RadioTech = 'LTE' | 'GSM' | 'WCDMA' | 'UNKNOWN';

export interface BaseStation {
  id: string;
  lat: number;
  lon: number;
  mcc: number;
  mnc: number;
  tech: RadioTech;
  description?: string;
}
