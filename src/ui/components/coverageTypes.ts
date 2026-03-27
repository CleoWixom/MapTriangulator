import type { CoverageConfig } from '../../map/config/coverage';
import type { CoverageFilters } from '../../map/filters/coverageFilters';
import type { RadioTech } from '../../types/cells';

export interface CoverageControlsProps {
  visible: boolean;
  config: CoverageConfig;
  filters: CoverageFilters;
  onVisibleChange: (value: boolean) => void;
  onTechColorChange: (tech: RadioTech, color: string) => void;
  onTechFilterToggle: (tech: RadioTech, enabled: boolean) => void;
  onMccChange: (mcc?: number) => void;
  onMncChange: (mnc?: number) => void;
  onRadiusRangeChange: (min?: number, max?: number) => void;
}
