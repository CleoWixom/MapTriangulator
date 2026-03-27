import L, { type LayerGroup } from 'leaflet';
import type { CoverageCircle } from '../../types/cells';

export const renderCoverageLayer = (
  circles: CoverageCircle[],
  targetLayer: LayerGroup,
): void => {
  targetLayer.clearLayers();

  circles.forEach((circle) => {
    L.circle(circle.center, {
      radius: circle.radiusMeters,
      color: circle.style.color,
      weight: 1,
      fillColor: circle.style.color,
      fillOpacity: circle.style.opacity,
    }).addTo(targetLayer);
  });
};
