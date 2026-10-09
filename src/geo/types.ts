// Coordinates follow GeoJSON order: [longitude, latitude], in degrees (WGS 84).
export type LngLat = readonly [number, number];
export type Ring = readonly LngLat[];
/** First ring is the outer boundary; any others are holes. */
export type PolygonCoords = readonly Ring[];
export type MultiPolygonCoords = readonly PolygonCoords[];

/** [west, south, east, north] */
export type BBox = readonly [number, number, number, number];
