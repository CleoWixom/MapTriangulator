import type { RadioTech } from '../../types/cells';

export interface CoverageLayerControlsProps {
  showCoverage: boolean;
  onToggleShowCoverage: (next: boolean) => void;
  selectedMcc?: number;
  selectedMnc?: number;
  selectedTech: RadioTech[];
  radiusRange: {
    min: number;
    max: number;
  };
  onMccChange: (mcc?: number) => void;
  onMncChange: (mnc?: number) => void;
  onTechChange: (tech: RadioTech[]) => void;
  onRadiusRangeChange: (range: { min: number; max: number }) => void;
}

const TECH_OPTIONS: RadioTech[] = ['LTE', 'GSM', 'WCDMA'];

export const CoverageLayerControls = ({
  showCoverage,
  onToggleShowCoverage,
  selectedMcc,
  selectedMnc,
  selectedTech,
  radiusRange,
  onMccChange,
  onMncChange,
  onTechChange,
  onRadiusRangeChange,
}: CoverageLayerControlsProps) => {
  return (
    <section>
      <label>
        <input
          type="checkbox"
          checked={showCoverage}
          onChange={(event) => onToggleShowCoverage(event.currentTarget.checked)}
        />
        Show coverage radius
      </label>

      <div>
        <label>
          MCC
          <input
            type="number"
            value={selectedMcc ?? ''}
            onChange={(event) =>
              onMccChange(
                event.currentTarget.value
                  ? Number.parseInt(event.currentTarget.value, 10)
                  : undefined,
              )
            }
          />
        </label>

        <label>
          MNC
          <input
            type="number"
            value={selectedMnc ?? ''}
            onChange={(event) =>
              onMncChange(
                event.currentTarget.value
                  ? Number.parseInt(event.currentTarget.value, 10)
                  : undefined,
              )
            }
          />
        </label>
      </div>

      <fieldset>
        <legend>Technology</legend>
        {TECH_OPTIONS.map((tech) => {
          const checked = selectedTech.includes(tech);
          return (
            <label key={tech}>
              <input
                type="checkbox"
                checked={checked}
                onChange={(event) => {
                  if (event.currentTarget.checked) {
                    onTechChange([...selectedTech, tech]);
                  } else {
                    onTechChange(selectedTech.filter((value) => value !== tech));
                  }
                }}
              />
              {tech}
            </label>
          );
        })}
      </fieldset>

      <div>
        <label>
          Radius min (m)
          <input
            type="number"
            value={radiusRange.min}
            onChange={(event) =>
              onRadiusRangeChange({
                ...radiusRange,
                min: Number.parseInt(event.currentTarget.value, 10) || 0,
              })
            }
          />
        </label>

        <label>
          Radius max (m)
          <input
            type="number"
            value={radiusRange.max}
            onChange={(event) =>
              onRadiusRangeChange({
                ...radiusRange,
                max: Number.parseInt(event.currentTarget.value, 10) || 0,
              })
            }
          />
        </label>
      </div>
    </section>
  );
};
