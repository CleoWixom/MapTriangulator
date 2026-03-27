import type { ChangeEvent } from 'react';
import type { RadioTech } from '../../types/cells';
import type { CoverageControlsProps } from './coverageTypes';

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
  radiusQuality,
  onVisibleChange,
  onTechColorChange,
  onTechFilterToggle,
  onMccChange,
  onMncChange,
  onRadiusRangeChange,
}: CoverageControlsProps) {
  const minRadius = filters.radiusRange?.min;
  const maxRadius = filters.radiusRange?.max;

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

      {radiusQuality && (
        <p>
          Missing real radius: {radiusQuality.missingRadius}/{radiusQuality.totalStations} (
          {(radiusQuality.missingShare * 100).toFixed(1)}%)
        </p>
      )}

      <fieldset>
        <legend>Color by technology</legend>
        {techList.map((tech) => (
          <label key={tech}>
            {tech}
            <input
              type="color"
              value={config.radiusStyleByTech[tech].color}
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
            value={minRadius ?? ''}
            onChange={(event) =>
              onRadiusRangeChange(parseOptionalNumber(event.target.value), maxRadius)
            }
          />
        </label>

        <label>
          Radius max (m)
          <input
            type="number"
            value={maxRadius ?? ''}
            onChange={(event) =>
              onRadiusRangeChange(minRadius, parseOptionalNumber(event.target.value))
            }
          />
        </label>
      </fieldset>
    </section>
  );
}
