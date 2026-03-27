import { CellMeasurement, ErrorAssessment, GeoPoint } from '../triangulation/error_model';

function formatDistanceMeters(value: number): string {
  if (!Number.isFinite(value)) {
    return 'n/a';
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)} km`;
  }

  return `${Math.round(value)} m`;
}

function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const r = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;

  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLon / 2);
  const q = s1 * s1 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * s2 * s2;
  return 2 * r * Math.asin(Math.min(Math.sqrt(q), 1));
}

function inferredWeight(signalDbm?: number, explicitWeight?: number): number {
  if (explicitWeight !== undefined) {
    return explicitWeight;
  }

  if (signalDbm === undefined) {
    return 0.5;
  }

  return Math.max(0.1, Math.min(1, (signalDbm + 120) / 70));
}

export interface TechnicalInfoPanelData {
  estimate: GeoPoint;
  measurements: CellMeasurement[];
  assessment: ErrorAssessment;
}

/**
 * Renders Technical Info panel as plain HTML.
 * Caller can inject the returned string into a side panel.
 */
export function buildTechnicalInfoHtml(data: TechnicalInfoPanelData): string {
  const rows = data.measurements
    .map((m) => {
      const d = haversineMeters(data.estimate, m.station);
      return `<tr>
<td>${m.mcc}/${m.mnc}/${m.lac}/${m.cid}</td>
<td>${m.technology}</td>
<td>${formatDistanceMeters(d)}</td>
<td>${m.signalDbm ?? 'n/a'} dBm</td>
<td>${inferredWeight(m.signalDbm, m.weight).toFixed(2)}</td>
<td>${formatDistanceMeters(m.radiusMeters)} ± ${formatDistanceMeters((m.radiusUncertaintyMeters ?? 0) + (m.accuracyMeters ?? 0))}</td>
</tr>`;
    })
    .join('\n');

  const confidencePercent = `${Math.round(data.assessment.confidenceScore * 100)}%`;

  return `<section class="technical-info">
<h3>Technical Info</h3>
<table>
<thead>
<tr>
<th>MCC/MNC/LAC/CID</th>
<th>Tech</th>
<th>Distance to fix</th>
<th>Signal</th>
<th>Weight</th>
<th>Input radius</th>
</tr>
</thead>
<tbody>
${rows}
</tbody>
</table>
<div class="error-summary">
<p><strong>GDOP-like:</strong> ${data.assessment.geometricGdop.toFixed(2)}</p>
<p><strong>Geometric σ:</strong> ${formatDistanceMeters(data.assessment.geometricSigmaMeters)}</p>
<p><strong>Radial σ:</strong> ${formatDistanceMeters(data.assessment.radialSigmaMeters)}</p>
<p><strong>CE50 / CE95:</strong> ${formatDistanceMeters(data.assessment.circularError50Meters)} / ${formatDistanceMeters(data.assessment.circularError95Meters)}</p>
<p><strong>Ellipse 95%:</strong> ${formatDistanceMeters(data.assessment.ellipse95.semiMajorMeters)} × ${formatDistanceMeters(data.assessment.ellipse95.semiMinorMeters)}</p>
<p><strong>Result confidence:</strong> ${confidencePercent}</p>
</div>
</section>`;
}
