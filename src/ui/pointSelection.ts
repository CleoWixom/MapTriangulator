import type { GeoPoint } from '../triangulation/engine';

export type PointSelectionMode = 'map-click' | 'browser-geolocation';

export interface MapClickEvent {
  latlng: {
    lat: number;
    lng: number;
  };
}

export interface PointSelectionHandlers {
  onPointSelected: (point: GeoPoint, mode: PointSelectionMode) => void;
  onError?: (message: string) => void;
}

/**
 * Binds both point selection modes:
 * 1) click on the map;
 * 2) browser geolocation.
 */
export class PointSelectionController {
  constructor(private readonly handlers: PointSelectionHandlers) {}

  selectFromMapClick(event: MapClickEvent): void {
    this.handlers.onPointSelected(
      {
        lat: event.latlng.lat,
        lon: event.latlng.lng,
      },
      'map-click',
    );
  }

  selectFromBrowserGeolocation(): void {
    if (!('geolocation' in navigator)) {
      this.handlers.onError?.('Browser geolocation API is unavailable.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.handlers.onPointSelected(
          {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          },
          'browser-geolocation',
        );
      },
      (error) => {
        this.handlers.onError?.(`Geolocation failed: ${error.message}`);
      },
      {
        enableHighAccuracy: true,
        timeout: 10_000,
      },
    );
  }
}
