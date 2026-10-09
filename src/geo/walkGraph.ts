/**
 * Oʻahu's walkable network (streets, footpaths, steps) as a compact graph, for offline
 * walking routes. Built from OpenStreetMap by scripts/data/build-graph.mjs.
 *
 * Nodes are intersections and dead ends. Each edge is one stretch of a single way
 * between two nodes, with its full shape (the points in between) kept so routes can be
 * drawn along the real road. Walking ignores one-way streets, so edges are undirected.
 */
export type WalkGraphData = {
  nodeLng: Float64Array;
  nodeLat: Float64Array;
  /** ZONE_CODE of the zone each node is in. */
  nodeZone: Uint8Array;
  edgeA: Uint32Array;
  edgeB: Uint32Array;
  /** Metres. */
  edgeLen: Float32Array;
  /** Index into `names`, or -1 for an unnamed path. */
  edgeName: Int32Array;
  /** The edge's in-between points (A to B order) are shape[start .. start+count). */
  shapeStart: Uint32Array;
  shapeCount: Uint32Array;
  shapeLng: Float64Array;
  shapeLat: Float64Array;
  names: string[];
};

export const ZONE_CODE = { none: 0, tsunami: 1, extreme: 2, safe: 3 } as const;

const MAGIC = 0x3247574b; // "KWG2"
const SCALE = 1e6; // coordinates stored as integer micro-degrees (~0.1 m)
const NO_NAME = 0xffff;

/**
 * Serialises the graph (names travel separately, as JSON). Layout, little-endian:
 * header (magic, nodes, edges, shape points); node lng/lat as int32 micro-degrees;
 * edge A/B as uint32; edge length as float32; edge name and shape-point count as uint16
 * (shape start offsets are rebuilt on load); shape lng/lat; node zones as uint8.
 */
export function encodeWalkGraph(g: Omit<WalkGraphData, 'names'>): ArrayBuffer {
  const nN = g.nodeLng.length;
  const nE = g.edgeA.length;
  const nS = g.shapeLng.length;
  const size = 16 + nN * 8 + nE * (4 + 4 + 4 + 2 + 2) + nS * 8 + nN;
  const buf = new ArrayBuffer(size);
  const dv = new DataView(buf);
  let o = 0;
  const u32 = (v: number) => (dv.setUint32(o, v, true), (o += 4));
  const i32 = (v: number) => (dv.setInt32(o, v, true), (o += 4));
  const f32 = (v: number) => (dv.setFloat32(o, v, true), (o += 4));
  const u16 = (v: number) => (dv.setUint16(o, v, true), (o += 2));
  u32(MAGIC);
  u32(nN);
  u32(nE);
  u32(nS);
  for (let i = 0; i < nN; i++) i32(Math.round(g.nodeLng[i]! * SCALE));
  for (let i = 0; i < nN; i++) i32(Math.round(g.nodeLat[i]! * SCALE));
  for (let i = 0; i < nE; i++) u32(g.edgeA[i]!);
  for (let i = 0; i < nE; i++) u32(g.edgeB[i]!);
  for (let i = 0; i < nE; i++) f32(g.edgeLen[i]!);
  for (let i = 0; i < nE; i++) {
    const n = g.edgeName[i]!;
    if (n >= NO_NAME) throw new Error('too many street names for uint16');
    u16(n < 0 ? NO_NAME : n);
  }
  let expect = 0;
  for (let i = 0; i < nE; i++) {
    if (g.shapeStart[i] !== expect) throw new Error('shapes must be stored in edge order');
    if (g.shapeCount[i]! > 0xffff) throw new Error('edge shape too long for uint16');
    u16(g.shapeCount[i]!);
    expect += g.shapeCount[i]!;
  }
  for (let i = 0; i < nS; i++) i32(Math.round(g.shapeLng[i]! * SCALE));
  for (let i = 0; i < nS; i++) i32(Math.round(g.shapeLat[i]! * SCALE));
  new Uint8Array(buf, o, nN).set(g.nodeZone);
  return buf;
}

export function decodeWalkGraph(buf: ArrayBuffer, names: string[]): WalkGraphData {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== MAGIC) throw new Error('Not a Kōkua walk graph');
  const nN = dv.getUint32(4, true);
  const nE = dv.getUint32(8, true);
  const nS = dv.getUint32(12, true);
  let o = 16;
  const read = <A extends Float64Array | Uint32Array | Float32Array | Int32Array>(
    out: A,
    bytes: number,
    get: (p: number) => number,
  ): A => {
    for (let i = 0; i < out.length; i++) out[i] = get(o + i * bytes);
    o += out.length * bytes;
    return out;
  };
  const deg = (p: number) => dv.getInt32(p, true) / SCALE;
  const u32 = (p: number) => dv.getUint32(p, true);
  const nodeLng = read(new Float64Array(nN), 4, deg);
  const nodeLat = read(new Float64Array(nN), 4, deg);
  const edgeA = read(new Uint32Array(nE), 4, u32);
  const edgeB = read(new Uint32Array(nE), 4, u32);
  const edgeLen = read(new Float32Array(nE), 4, (p) => dv.getFloat32(p, true));
  const edgeName = read(new Int32Array(nE), 2, (p) => {
    const v = dv.getUint16(p, true);
    return v === NO_NAME ? -1 : v;
  });
  const shapeCount = read(new Uint32Array(nE), 2, (p) => dv.getUint16(p, true));
  const shapeStart = new Uint32Array(nE);
  for (let i = 1; i < nE; i++) shapeStart[i] = shapeStart[i - 1]! + shapeCount[i - 1]!;
  const shapeLng = read(new Float64Array(nS), 4, deg);
  const shapeLat = read(new Float64Array(nS), 4, deg);
  const nodeZone = new Uint8Array(buf.slice(o, o + nN));
  return {
    nodeLng,
    nodeLat,
    nodeZone,
    edgeA,
    edgeB,
    edgeLen,
    edgeName,
    shapeStart,
    shapeCount,
    shapeLng,
    shapeLat,
    names,
  };
}
