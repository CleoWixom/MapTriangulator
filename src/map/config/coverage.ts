import type { RadioTech, RadiusStyle } from '../../types/cells';

export interface CoverageTechConfig {
  radiusMeters: number;
  style: RadiusStyle;
}

export interface CoverageConfig {
  showCoverage: boolean;
  minRadiusMeters: number;
  maxRadiusMeters: number;
  /**
   * Legacy debug mode: allows synthetic fallback radii by tech when station has
   * no measured/modeled value. Disabled by default for production-like behavior.
   */
  enableLegacyFallbackRadii: boolean;
  radiusFallbackByTech: Record<RadioTech, CoverageTechConfig>;
}

export const DEFAULT_COVERAGE_CONFIG: CoverageConfig = {
  showCoverage: true,
  minRadiusMeters: 0,
  maxRadiusMeters: 10_000,
  enableLegacyFallbackRadii: false,
  radiusFallbackByTech: {
    LTE: {
      radiusMeters: 2000,
      style: {
        color: '#1e88e5',
        opacity: 0.25,
      },
    },
    GSM: {
      radiusMeters: 3500,
      style: {
        color: '#43a047',
        opacity: 0.2,
      },
    },
    WCDMA: {
      radiusMeters: 2500,
      style: {
        color: '#8e24aa',
        opacity: 0.22,
      },
    },
    UNKNOWN: {
      radiusMeters: 1000,
      style: {
        color: '#757575',
        opacity: 0.18,
      },
    },
  },
};
