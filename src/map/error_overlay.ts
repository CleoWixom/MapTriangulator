import { ErrorAssessment, GeoPoint, toGeoJsonErrorContour } from '../triangulation/error_model';

export interface ErrorOverlayData {
  contour: GeoJSON.Feature<GeoJSON.Polygon>;
  centerLabel: GeoJSON.Feature<GeoJSON.Point>;
}

/**
 * Prepare map objects for probability contour visualization:
 * - 95% ellipse contour polygon
 * - center point label with numeric error in meters
 */
export function buildErrorOverlay(assessment: ErrorAssessment, center: GeoPoint): ErrorOverlayData {
  const contour = toGeoJsonErrorContour(assessment);

  const centerLabel: GeoJSON.Feature<GeoJSON.Point> = {
    type: 'Feature',
    properties: {
      label: `±${Math.round(assessment.circularError95Meters)} m (95%)`,
      confidence: assessment.confidenceScore,
    },
    geometry: {
      type: 'Point',
      coordinates: [center.lon, center.lat],
    },
  };

  return { contour, centerLabel };
}
