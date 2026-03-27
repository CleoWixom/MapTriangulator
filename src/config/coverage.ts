import type { RadioTech } from '../types/baseStation';

export interface CoverageTechStyle {
  radiusMeters: number;
  color: string;
}

export interface CoverageConfig {
  opacity: number;
  tech: Record<RadioTech, CoverageTechStyle>;
}

export const defaultCoverageConfig: CoverageConfig = {
  opacity: 0.2,
  tech: {
    LTE: { radiusMeters: 1200, color: '#1976d2' },
    GSM: { radiusMeters: 2800, color: '#ff9800' },
    WCDMA: { radiusMeters: 1800, color: '#43a047' },
    UNKNOWN: { radiusMeters: 1000, color: '#9e9e9e' },
  },
};
