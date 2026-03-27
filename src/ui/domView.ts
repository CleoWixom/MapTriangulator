import type { TriangulationResult } from '../triangulation/engine';
import type { TriangulationView } from './triangulationPresenter';

export interface TriangulationDomElements {
  statusNode: HTMLElement;
  stationCountNode: HTMLElement;
  cellListNode: HTMLElement;
  errorNode?: HTMLElement;
}

export class TriangulationDomView implements TriangulationView {
  constructor(private readonly elements: TriangulationDomElements) {}

  renderResult(result: TriangulationResult): void {
    this.elements.statusNode.textContent = result.triangulation_possible;
    this.elements.stationCountNode.textContent = String(result.suitable_station_count);

    this.elements.cellListNode.innerHTML = '';
    result.participating_cells.forEach((cell) => {
      const li = document.createElement('li');
      li.textContent = `${cell.sectorId} (${cell.stationId}, ${cell.technology}, q=${cell.signalQuality.toFixed(2)})`;
      this.elements.cellListNode.appendChild(li);
    });

    if (this.elements.errorNode) {
      this.elements.errorNode.textContent = '';
    }
  }

  renderError(message: string): void {
    if (this.elements.errorNode) {
      this.elements.errorNode.textContent = message;
    }
  }
}
