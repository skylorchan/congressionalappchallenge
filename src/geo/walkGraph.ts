import type { LngLat } from './types';

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

const MAGIC = 0x3147574b; // "KWG1"
const SCALE = 1e6; // coordinates stored as integer micro-degrees (~0.1 m)

/** Serialises the graph (names travel separately, as JSON). */
export function encodeWalkGraph(g: Omit<WalkGraphData, 'names'>): ArrayBuffer {
  const nN = g.nodeLng.length;
  const nE = g.edgeA.length;
  const nS = g.shapeLng.length;
  const words = 5 + 2 * nN + 6 * nE + 2 * nS;
  const buf = new ArrayBuffer(words * 4 + nN);
  const dv = new DataView(buf);
  let o = 0;
  const u32 = (v: number) => (dv.setUint32(o, v, true), (o += 4));
  const i32 = (v: number) => (dv.setInt32(o, v, true), (o += 4));
  const f32 = (v: number) => (dv.setFloat32(o, v, true), (o += 4));
  u32(MAGIC);
  u32(1);
  u32(nN);
  u32(nE);
  u32(nS);
  for (let i = 0; i < nN; i++) i32(Math.round(g.nodeLng[i]! * SCALE));
  for (let i = 0; i < nN; i++) i32(Math.round(g.nodeLat[i]! * SCALE));
  for (let i = 0; i < nE; i++) u32(g.edgeA[i]!);
  for (let i = 0; i < nE; i++) u32(g.edgeB[i]!);
  for (let i = 0; i < nE; i++) f32(g.edgeLen[i]!);
  for (let i = 0; i < nE; i++) i32(g.edgeName[i]!);
  for (let i = 0; i < nE; i++) u32(g.shapeStart[i]!);
  for (let i = 0; i < nE; i++) u32(g.shapeCount[i]!);
  for (let i = 0; i < nS; i++) i32(Math.round(g.shapeLng[i]! * SCALE));
  for (let i = 0; i < nS; i++) i32(Math.round(g.shapeLat[i]! * SCALE));
  new Uint8Array(buf, o, nN).set(g.nodeZone);
  return buf;
}

export function decodeWalkGraph(buf: ArrayBuffer, names: string[]): WalkGraphData {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== MAGIC) throw new Error('Not a Kōkua walk graph');
  const nN = dv.getUint32(8, true);
  const nE = dv.getUint32(12, true);
  const nS = dv.getUint32(16, true);
  let o = 20;
  const take = <T>(
    n: number,
    read: (i: number) => number,
    make: (n: number) => T & { [i: number]: number },
  ) => {
    const out = make(n);
    for (let i = 0; i < n; i++) out[i] = read(o + i * 4);
    o += n * 4;
    return out;
  };
  const deg = (p: number) => dv.getInt32(p, true) / SCALE;
  const u32 = (p: number) => dv.getUint32(p, true);
  const nodeLng = take(nN, deg, (n) => new Float64Array(n));
  const nodeLat = take(nN, deg, (n) => new Float64Array(n));
  const edgeA = take(nE, u32, (n) => new Uint32Array(n));
  const edgeB = take(nE, u32, (n) => new Uint32Array(n));
  const edgeLen = take(
    nE,
    (p) => dv.getFloat32(p, true),
    (n) => new Float32Array(n),
  );
  const edgeName = take(
    nE,
    (p) => dv.getInt32(p, true),
    (n) => new Int32Array(n),
  );
  const shapeStart = take(nE, u32, (n) => new Uint32Array(n));
  const shapeCount = take(nE, u32, (n) => new Uint32Array(n));
  const shapeLng = take(nS, deg, (n) => new Float64Array(n));
  const shapeLat = take(nS, deg, (n) => new Float64Array(n));
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
