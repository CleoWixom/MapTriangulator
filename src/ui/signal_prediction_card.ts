import { SignalForecast, SignalPrediction } from '../types/radio';

export interface PredictionCardRow {
  stationId: string;
  predictedDbm: number;
  qualityLabel: string;
}

export interface PredictionCardModel {
  title: string;
  rows: PredictionCardRow[];
  triangulationVerdict: 'можно триангулировать' | 'нельзя триангулировать';
  statusBadge: 'available' | 'degraded' | 'unavailable';
}

export function buildPredictionCardModel(forecast: SignalForecast): PredictionCardModel {
  return {
    title: 'Прогноз сигнала в выбранной точке',
    rows: forecast.perStation.map(toRow),
    triangulationVerdict: forecast.canTriangulate ? 'можно триангулировать' : 'нельзя триангулировать',
    statusBadge: forecast.triangulationStatus,
  };
}

export function renderPredictionCardHtml(forecast: SignalForecast): string {
  const model = buildPredictionCardModel(forecast);

  const rows = model.rows
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.stationId)}</td>
          <td>${row.predictedDbm.toFixed(1)} dBm</td>
          <td>${escapeHtml(row.qualityLabel)}</td>
        </tr>`,
    )
    .join('');

  return `
    <section class="signal-prediction-card" data-status="${model.statusBadge}">
      <h3>${model.title}</h3>
      <table>
        <thead>
          <tr>
            <th>Cell</th>
            <th>Signal</th>
            <th>Quality</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="triangulation-verdict">Итог: <strong>${model.triangulationVerdict}</strong></p>
    </section>
  `;
}

function toRow(prediction: SignalPrediction): PredictionCardRow {
  return {
    stationId: prediction.stationId,
    predictedDbm: prediction.interpolatedDbm,
    qualityLabel: qualityToRu(prediction.quality),
  };
}

function qualityToRu(quality: SignalPrediction['quality']): string {
  switch (quality) {
    case 'excellent':
      return 'Отличный';
    case 'good':
      return 'Хороший';
    case 'fair':
      return 'Средний';
    case 'poor':
      return 'Слабый';
    default:
      return 'Непригодный';
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
