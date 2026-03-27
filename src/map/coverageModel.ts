import { defaultCoverageConfig, type CoverageConfig } from '../config/coverage';
import {
  defaultCoverageFilters,
  filterStationsByCoverage,
  type CoverageFilters,
} from './filters/coverageFilters';
import { buildCoverageLayer, type CoverageLayerData } from './layers/coverage';
import type { BaseStation, RadioTech } from '../types/baseStation';

export interface CoverageState {
  visible: boolean;
  config: CoverageConfig;
  filters: CoverageFilters;
}

export const defaultCoverageState: CoverageState = {
  visible: true,
  config: defaultCoverageConfig,
  filters: defaultCoverageFilters,
};

export function buildCoverageFromState(
  stations: BaseStation[],
  state: CoverageState,
): CoverageLayerData {
  const filteredStations = filterStationsByCoverage(stations, state.filters, state.config);
  return buildCoverageLayer(filteredStations, state.config, state.visible);
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
