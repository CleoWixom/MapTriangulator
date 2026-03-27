declare namespace GeoJSON {
  interface Geometry {
    type: string;
  }

  interface Point extends Geometry {
    type: 'Point';
    coordinates: [number, number];
  }

  interface Polygon extends Geometry {
    type: 'Polygon';
    coordinates: [Array<[number, number]>, ...Array<Array<[number, number]>>];
  }

  interface Feature<G extends Geometry = Geometry, P = Record<string, unknown>> {
    type: 'Feature';
    geometry: G;
    properties: P;
  }
}
