import { calculateTriangulation, type Sector, type TriangulationResult } from '../triangulation/engine';
import { PointSelectionController } from './pointSelection';

export interface TriangulationView {
  renderResult: (result: TriangulationResult) => void;
  renderError: (message: string) => void;
}

/**
 * Connects point selection modes with triangulation engine and UI rendering.
 */
export class TriangulationPresenter {
  private readonly pointSelection: PointSelectionController;

  constructor(private readonly sectors: Sector[], private readonly view: TriangulationView) {
    this.pointSelection = new PointSelectionController({
      onPointSelected: (point) => {
        const result = calculateTriangulation({
          point,
          sectors: this.sectors,
        });

        this.view.renderResult(result);
      },
      onError: (message) => this.view.renderError(message),
    });
  }

  onMapClicked(lat: number, lon: number): void {
    this.pointSelection.selectFromMapClick({
      latlng: {
        lat,
        lng: lon,
      },
    });
  }

  requestBrowserLocation(): void {
    this.pointSelection.selectFromBrowserGeolocation();
  }
}
