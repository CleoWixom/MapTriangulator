import {
  DEFAULT_COVERAGE_CONFIG,
  type CoverageConfig,
} from './config/coverage';
import {
  defaultCoverageFilters,
  filterCoverageCircles,
  type CoverageFilters,
} from './filters/coverageFilters';
import {
  buildCoverageCircles,
  calculateCoverageRadiusQuality,
  type CoverageRadiusQuality,
} from './layers/coverage';
import type { BaseStation, CoverageCircle, RadioTech } from '../types/cells';

export interface CoverageState {
  visible: boolean;
  config: CoverageConfig;
  filters: CoverageFilters;
}

export const defaultCoverageState: CoverageState = {
  visible: true,
  config: DEFAULT_COVERAGE_CONFIG,
  filters: defaultCoverageFilters,
};

export function buildCoverageFromState(
  stations: BaseStation[],
  state: CoverageState,
): CoverageCircle[] {
  if (!state.visible) {
    return [];
  }

  const circles = buildCoverageCircles(stations, state.config);
  return filterCoverageCircles(circles, state.filters);
}

export function buildCoverageRadiusQualityFromState(
  stations: BaseStation[],
  state: CoverageState,
): CoverageRadiusQuality {
  return calculateCoverageRadiusQuality(stations, state.config);
}

export function toggleTechFilter(
  filters: CoverageFilters,
  tech: RadioTech,
  enabled: boolean,
): CoverageFilters {
  const current = new Set(filters.tech);
  if (enabled) {
    current.add(tech);
  } else {
    current.delete(tech);
  }

  return {
    ...filters,
    tech: Array.from(current),
  };
}
