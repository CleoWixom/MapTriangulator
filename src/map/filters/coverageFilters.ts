import type { BaseStation, RadioTech } from '../../types/baseStation';
import { resolveCoverageRadius } from '../layers/coverage';
import type { CoverageConfig } from '../../config/coverage';

export interface CoverageFilters {
  mcc?: number;
  mnc?: number;
  tech: RadioTech[];
  minRadius?: number;
  maxRadius?: number;
}

export const defaultCoverageFilters: CoverageFilters = {
  tech: ['LTE', 'GSM', 'WCDMA', 'UNKNOWN'],
};

export function filterStationsByCoverage(
  stations: BaseStation[],
  filters: CoverageFilters,
  config: CoverageConfig,
): BaseStation[] {
  return stations.filter((station) => {
    if (filters.mcc != null && station.mcc !== filters.mcc) {
      return false;
    }

    if (filters.mnc != null && station.mnc !== filters.mnc) {
      return false;
    }

    if (filters.tech.length > 0 && !filters.tech.includes(station.tech)) {
      return false;
    }

    const radius = resolveCoverageRadius(station, config);
    if (filters.minRadius != null && radius < filters.minRadius) {
      return false;
    }

    if (filters.maxRadius != null && radius > filters.maxRadius) {
      return false;
    }

    return true;
  });
}
