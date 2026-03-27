import type { ChangeEvent } from 'react';
import type { CoverageConfig } from '../../config/coverage';
import type { CoverageFilters } from '../../map/filters/coverageFilters';
import type { RadioTech } from '../../types/baseStation';

interface CoverageControlsProps {
  visible: boolean;
  config: CoverageConfig;
  filters: CoverageFilters;
  onVisibleChange: (value: boolean) => void;
  onOpacityChange: (value: number) => void;
  onTechColorChange: (tech: RadioTech, color: string) => void;
  onTechFilterToggle: (tech: RadioTech, enabled: boolean) => void;
  onMccChange: (mcc?: number) => void;
  onMncChange: (mnc?: number) => void;
  onRadiusRangeChange: (min?: number, max?: number) => void;
}

const techList: RadioTech[] = ['LTE', 'GSM', 'WCDMA', 'UNKNOWN'];

function parseOptionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function CoverageControls({
  visible,
  config,
  filters,
  onVisibleChange,
  onOpacityChange,
  onTechColorChange,
  onTechFilterToggle,
  onMccChange,
  onMncChange,
  onRadiusRangeChange,
}: CoverageControlsProps) {
  return (
    <section>
      <h3>Coverage</h3>

      <label>
        <input
          type="checkbox"
          checked={visible}
          onChange={(event) => onVisibleChange(event.target.checked)}
        />
        Show coverage radii
      </label>

      <label>
        Opacity
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={config.opacity}
          onChange={(event) => onOpacityChange(Number(event.target.value))}
        />
      </label>

      <fieldset>
        <legend>Color by technology</legend>
        {techList.map((tech) => (
          <label key={tech}>
            {tech}
            <input
              type="color"
              value={config.tech[tech].color}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                onTechColorChange(tech, event.target.value)
              }
            />
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>Filters</legend>

        <label>
          MCC
          <input
            type="number"
            value={filters.mcc ?? ''}
            onChange={(event) => onMccChange(parseOptionalNumber(event.target.value))}
          />
        </label>

        <label>
          MNC
          <input
            type="number"
            value={filters.mnc ?? ''}
            onChange={(event) => onMncChange(parseOptionalNumber(event.target.value))}
          />
        </label>

        <div>
          Technology
          {techList.map((tech) => (
            <label key={tech}>
              <input
                type="checkbox"
                checked={filters.tech.includes(tech)}
                onChange={(event) => onTechFilterToggle(tech, event.target.checked)}
              />
              {tech}
            </label>
          ))}
        </div>

        <label>
          Radius min (m)
          <input
            type="number"
            value={filters.minRadius ?? ''}
            onChange={(event) =>
              onRadiusRangeChange(parseOptionalNumber(event.target.value), filters.maxRadius)
            }
          />
        </label>

        <label>
          Radius max (m)
          <input
            type="number"
            value={filters.maxRadius ?? ''}
            onChange={(event) =>
              onRadiusRangeChange(filters.minRadius, parseOptionalNumber(event.target.value))
            }
          />
        </label>
      </fieldset>
    </section>
  );
}
