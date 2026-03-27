export const MARKER_CLASSES = {
  servingCell: 'serving_cell',
  neighborCell: 'neighbor_cell',
  signalSample: 'signal_sample',
  trackPoint: 'track_point',
  userProbe: 'user_probe',
} as const;

export type MarkerClass = (typeof MARKER_CLASSES)[keyof typeof MARKER_CLASSES];

const SIGNAL_STYLE_RE = /^#style_(\d{1,3})$/i;

export type SignalQuality = 'excellent' | 'good' | 'medium' | 'poor' | 'unknown';

export interface MarkerStyleResult {
  classes: MarkerClass[];
  /**
   * Цвет для точек сигнала. Основан на dBm (приоритетно) и fallback на styleUrl.
   */
  color?: string;
  /**
   * Текстовое качество сигнала для легенды/tooltip.
   */
  quality?: SignalQuality;
}

export interface SignalLegendItem {
  label: string;
  color: string;
}

/**
 * Шкала dBm для signal_sample.
 * Пороговые значения: >= -70 отлично, -85 средне, <= -105 плохо.
 */
export function getSignalQuality(dbm: number | null | undefined): SignalQuality {
  if (dbm == null || Number.isNaN(dbm)) {
    return 'unknown';
  }

  if (dbm >= -70) return 'excellent';
  if (dbm >= -85) return 'good';
  if (dbm >= -95) return 'medium';
  if (dbm <= -105) return 'poor';
  return 'medium';
}

/**
 * Цвета качества сигнала для UI (от лучшего к худшему).
 */
export const SIGNAL_QUALITY_COLORS: Record<Exclude<SignalQuality, 'unknown'>, string> = {
  excellent: '#2ecc71',
  good: '#8bc34a',
  medium: '#f1c40f',
  poor: '#e74c3c',
};

function clampStyleLevel(level: number): number {
  return Math.max(0, Math.min(100, level));
}

/**
 * Fallback шкала, если dBm недоступен: #style_0..#style_100
 * 0 -> poor, 100 -> excellent.
 */
function getQualityFromStyleUrl(styleUrl: string): SignalQuality {
  const m = styleUrl.match(SIGNAL_STYLE_RE);
  if (!m) return 'unknown';

  const level = clampStyleLevel(Number(m[1]));
  if (level >= 80) return 'excellent';
  if (level >= 60) return 'good';
  if (level >= 40) return 'medium';
  return 'poor';
}

function getColorByQuality(quality: SignalQuality): string | undefined {
  if (quality === 'unknown') return undefined;
  return SIGNAL_QUALITY_COLORS[quality];
}

/**
 * Извлекает dBm из значения вида "-97" или произвольной строки.
 */
export function parseDbm(value: string | null | undefined): number | undefined {
  if (!value) return undefined;

  const exact = value.trim().match(/^-\d{1,3}$/);
  if (exact) return Number(exact[0]);

  const inline = value.match(/(-\d{1,3})\s*dBm/i);
  if (inline) return Number(inline[1]);

  return undefined;
}

/**
 * Маппинг KML styleUrl -> классы слоя + цвет.
 */
export function getMarkerStyleByKmlStyle(styleUrl: string, dbm?: number | null): MarkerStyleResult {
  switch (styleUrl) {
    case '#style_cur':
      return { classes: [MARKER_CLASSES.servingCell] };
    case '#style_neigh':
      return { classes: [MARKER_CLASSES.neighborCell] };
    case '#styletp':
      return { classes: [MARKER_CLASSES.trackPoint] };
    case '#style_probe':
      return { classes: [MARKER_CLASSES.userProbe] };
    default:
      if (SIGNAL_STYLE_RE.test(styleUrl)) {
        const quality = dbm == null ? getQualityFromStyleUrl(styleUrl) : getSignalQuality(dbm);
        return {
          classes: [MARKER_CLASSES.signalSample],
          quality,
          color: getColorByQuality(quality),
        };
      }
      return { classes: [] };
  }
}

export const MAP_LEGEND = {
  markers: [
    { label: 'Serving cell', className: MARKER_CLASSES.servingCell, color: '#00ff00', icon: '◆' },
    { label: 'Neighbor cell', className: MARKER_CLASSES.neighborCell, color: '#00ffff', icon: '◆' },
    { label: 'Track point', className: MARKER_CLASSES.trackPoint, color: '#000000', icon: '━' },
    { label: 'User probe', className: MARKER_CLASSES.userProbe, color: '#9c27b0', icon: '⬤' },
  ],
  signal: [
    { label: 'Отлично (≥ -70 dBm)', color: SIGNAL_QUALITY_COLORS.excellent },
    { label: 'Хорошо (-71…-85 dBm)', color: SIGNAL_QUALITY_COLORS.good },
    { label: 'Средне (-86…-105 dBm)', color: SIGNAL_QUALITY_COLORS.medium },
    { label: 'Плохо (≤ -105 dBm)', color: SIGNAL_QUALITY_COLORS.poor },
  ] satisfies SignalLegendItem[],
} as const;

/**
 * Простой HTML фрагмент легенды для встраивания на карту.
 */
export function buildMapLegendHtml(): string {
  const markerRows = MAP_LEGEND.markers
    .map(
      (item) =>
        `<li><span class="legend-icon ${item.className}" style="color:${item.color}">${item.icon}</span>${item.label}</li>`,
    )
    .join('');

  const signalRows = MAP_LEGEND.signal
    .map((item) => `<li><span class="legend-swatch" style="background:${item.color}"></span>${item.label}</li>`)
    .join('');

  return `
    <section class="map-legend" aria-label="Легенда карты">
      <h4>Объекты</h4>
      <ul>${markerRows}</ul>
      <h4>Signal sample (dBm)</h4>
      <ul>${signalRows}</ul>
    </section>
  `;
}
