import type { LngLat } from './types';

/** Mean Earth radius in metres (IUGG). */
export const EARTH_RADIUS_M = 6_371_008.8;

const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Great-circle distance in metres (haversine formula). */
export function distanceMeters(a: LngLat, b: LngLat): number {
  const φ1 = rad(a[1]);
  const φ2 = rad(b[1]);
  const dφ = φ2 - φ1;
  const dλ = rad(b[0] - a[0]);
  const h = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial compass bearing from a to b, in degrees clockwise from true north (0-360). */
export function bearingDegrees(a: LngLat, b: LngLat): number {
  const φ1 = rad(a[1]);
  const φ2 = rad(b[1]);
  const dλ = rad(b[0] - a[0]);
  const y = Math.sin(dλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dλ);
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

export const COMPASS_POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
export type CompassPoint = (typeof COMPASS_POINTS)[number];

/** Rounds a bearing to the nearest of 8 compass points. */
export function compassPoint(bearing: number): CompassPoint {
  const i = Math.round((((bearing % 360) + 360) % 360) / 45) % 8;
  return COMPASS_POINTS[i]!;
}

/**
 * Projects lng/lat to local flat metres around an origin (equirectangular). Accurate to
 * well under 1% within a few km, which is all the nearest-exit search needs.
 */
export function makeLocalProjection(origin: LngLat) {
  const kx = EARTH_RADIUS_M * rad(1) * Math.cos(rad(origin[1]));
  const ky = EARTH_RADIUS_M * rad(1);
  return {
    toXY: ([lng, lat]: LngLat): [number, number] => [
      (lng - origin[0]) * kx,
      (lat - origin[1]) * ky,
    ],
    toLngLat: ([x, y]: readonly [number, number]): LngLat => [
      origin[0] + x / kx,
      origin[1] + y / ky,
    ],
  };
}
