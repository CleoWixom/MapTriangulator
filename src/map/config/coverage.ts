import type { RadioTech, RadiusStyle } from '../../types/cells';

export interface CoverageConfig {
  showCoverage: boolean;
  minRadiusMeters: number;
  maxRadiusMeters: number;
  radiusStyleByTech: Record<RadioTech, RadiusStyle>;
}

export const DEFAULT_COVERAGE_CONFIG: CoverageConfig = {
  showCoverage: true,
  minRadiusMeters: 0,
  maxRadiusMeters: 10_000,
  radiusStyleByTech: {
    LTE: {
      color: '#1e88e5',
      opacity: 0.25,
    },
    GSM: {
      color: '#43a047',
      opacity: 0.2,
    },
    WCDMA: {
      color: '#8e24aa',
      opacity: 0.22,
    },
    UNKNOWN: {
      color: '#757575',
      opacity: 0.18,
    },
  },
};
