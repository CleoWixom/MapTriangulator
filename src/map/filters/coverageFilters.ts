import type { CoverageCircle, RadioTech } from '../../types/cells';

export interface CoverageFilters {
  mcc?: number;
  mnc?: number;
  tech: RadioTech[];
  radiusRange?: {
    min: number;
    max: number;
  };
}

export const defaultCoverageFilters: CoverageFilters = {
  tech: [],
};

export const filterCoverageCircles = (
  circles: CoverageCircle[],
  filters: CoverageFilters,
): CoverageCircle[] => {
  return circles.filter((circle) => {
    if (typeof filters.mcc === 'number' && circle.mcc !== filters.mcc) {
      return false;
    }

    if (typeof filters.mnc === 'number' && circle.mnc !== filters.mnc) {
      return false;
    }

    if (filters.tech.length > 0 && !filters.tech.includes(circle.tech)) {
      return false;
    }

    if (filters.radiusRange) {
      const { min, max } = filters.radiusRange;
      if (circle.radiusMeters < min || circle.radiusMeters > max) {
        return false;
      }
    }

    return true;
  });
};
