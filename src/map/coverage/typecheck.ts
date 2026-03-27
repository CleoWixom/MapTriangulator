import type { CoverageConfig } from './index';
import type { CoverageState } from '../coverageModel';
import type { CoverageFilters } from '../filters/coverageFilters';
import type { CoverageControlsProps } from '../../ui/components/coverageTypes';

type Extends<T, U> = [T] extends [U] ? true : false;
type Assert<T extends true> = T;

type _StateFiltersCompatible = Assert<
  Extends<CoverageState['filters'], CoverageFilters>
>;
type _StateConfigCompatible = Assert<
  Extends<CoverageState['config'], CoverageConfig>
>;

type _ControlsFilterCompatible = Assert<
  Extends<CoverageControlsProps['filters'], CoverageFilters>
>;
type _ControlsConfigCompatible = Assert<
  Extends<CoverageControlsProps['config'], CoverageConfig>
>;

type _ControlsRadiusCallbackCompatible = Assert<
  Extends<
    Parameters<CoverageControlsProps['onRadiusRangeChange']>,
    [min?: number, max?: number]
  >
>;

export {};
