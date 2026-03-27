# MapTriangulator

## Triangulation engine

Added `src/triangulation/engine.ts` with service for evaluating whether triangulation is possible for a point and a set of sectors/stations.

Result contains:

- `triangulation_possible: yes/no`
- count of suitable base stations (`suitable_station_count`)
- list of participating cells (`participating_cells`)

Selection and weighting logic:

1. Select sectors where point is inside coverage radius.
2. Count unique stations for minimal 2D criteria: `>= 3` stations.
3. Prefer `>= 4` stations for better stability.
4. Weight by technology and signal quality.

## UI point selection modes

Added UI controllers:

- click on map (`map-click` mode)
- browser geolocation (`browser-geolocation` mode)

Files:

- `src/ui/pointSelection.ts`
- `src/ui/triangulationPresenter.ts`
- `src/ui/domView.ts`

## Type check

Use the dedicated config for type-checking:

```bash
npx --yes --package typescript tsc --project tsconfig.typecheck.json
```

Or via Make:

```bash
make typecheck
```
