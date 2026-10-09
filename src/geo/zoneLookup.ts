import { bboxOf, inBBox, pointInMultiPolygon } from './pointInPolygon';
import type { BBox, LngLat, MultiPolygonCoords } from './types';

/**
 * tsunami = Tsunami Evacuation Zone (evacuate for any tsunami warning).
 * extreme = Extreme Tsunami Evacuation Zone (evacuate only when officials call for it,
 *           e.g. a very large distant earthquake). It contains the tsunami zone.
 */
export type ZoneKind = 'tsunami' | 'extreme';

export type Zone = {
  id: string;
  kind: ZoneKind;
  coords: MultiPolygonCoords;
  bbox: BBox;
};

export type ZoneStatus =
  /** In the tsunami evacuation zone. */
  | 'tsunami'
  /** Outside the tsunami zone but inside the extreme tsunami zone. */
  | 'extreme'
  /** Outside both zones, within the area the data covers. */
  | 'safe'
  /** Outside the area the zone data covers, so we can't say. */
  | 'no-data';

export type ZoneResult = { status: ZoneStatus; zones: Zone[] };

type ZoneFeature = {
  id?: string | number;
  properties: { kind: ZoneKind; id?: string };
  geometry:
    | { type: 'Polygon'; coordinates: MultiPolygonCoords[number] }
    | { type: 'MultiPolygon'; coordinates: MultiPolygonCoords };
};
export type ZoneCollection = { features: readonly ZoneFeature[]; coverage: BBox };

export class ZoneIndex {
  readonly zones: readonly Zone[];
  readonly coverage: BBox;

  constructor(zones: readonly Zone[], coverage: BBox) {
    this.zones = zones;
    this.coverage = coverage;
  }

  static fromGeoJSON(fc: ZoneCollection): ZoneIndex {
    const zones = fc.features.map((f, i): Zone => {
      const coords =
        f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
      return {
        id: String(f.properties.id ?? f.id ?? i),
        kind: f.properties.kind,
        coords,
        bbox: bboxOf(coords),
      };
    });
    return new ZoneIndex(zones, fc.coverage);
  }

  /** Every zone containing the point. Cheap bbox check first, exact test second. */
  zonesAt(point: LngLat, kind?: ZoneKind): Zone[] {
    return this.zones.filter(
      (z) =>
        (kind === undefined || z.kind === kind) &&
        inBBox(point, z.bbox) &&
        pointInMultiPolygon(point, z.coords),
    );
  }

  lookup(point: LngLat): ZoneResult {
    if (!inBBox(point, this.coverage)) return { status: 'no-data', zones: [] };
    const zones = this.zonesAt(point);
    const status: ZoneStatus = zones.some((z) => z.kind === 'tsunami')
      ? 'tsunami'
      : zones.some((z) => z.kind === 'extreme')
        ? 'extreme'
        : 'safe';
    return { status, zones };
  }

  ofKind(kind: ZoneKind): Zone[] {
    return this.zones.filter((z) => z.kind === kind);
  }
}
