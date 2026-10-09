// Builds the offline walking graph (public/data/walk.bin + walk.json) from the OpenStreetMap
// roads and paths in data/raw/osm-walk.geojsonseq.gz. Called by build.mjs.
//
// Steps:
//  1. keep ways people can walk on (no freeways, nothing tagged foot/access = no/private);
//  2. find intersections (points shared by two or more ways) and dead ends;
//  3. split ways at intersections into edges, keeping the points in between as shape;
//  4. keep only the largest connected network, so a GPS point never snaps onto an
//     isolated path with no way out;
//  5. tag each intersection with the tsunami zone it's in (same code the app uses).
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { distanceMeters, makeLocalProjection } from '../../src/geo/distance.ts';
import { bboxOf, inBBox, makePolygonTester } from '../../src/geo/pointInPolygon.ts';
import { encodeWalkGraph, ZONE_CODE } from '../../src/geo/walkGraph.ts';

const NOT_WALKABLE = new Set([
  'motorway',
  'motorway_link',
  'construction',
  'proposed',
  'raceway',
  'bus_guideway',
  'platform',
  'corridor',
  'elevator',
  'abandoned',
  'razed',
  'no',
  'escape',
  'busway',
]);
const NO = new Set(['no', 'private']);
const FOOT_OK = new Set(['yes', 'designated', 'permissive']);

/**
 * Douglas-Peucker: drops shape points that are within `tol` metres of the line through
 * their neighbours. Ends are kept. Route lengths are measured before simplifying, so
 * distances stay exact; only the drawn line changes, by under 2 m.
 */
function simplify(pts, tol = 2) {
  if (pts.length <= 2) return pts;
  const proj = makeLocalProjection(pts[0]);
  const xy = pts.map((p) => proj.toXY(p));
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop();
    const [ax, ay] = xy[i];
    const [bx, by] = xy[j];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    let far = -1;
    let farD = tol;
    for (let k = i + 1; k < j; k++) {
      const d = Math.abs((xy[k][0] - ax) * dy - (xy[k][1] - ay) * dx) / len;
      if (d > farD) {
        farD = d;
        far = k;
      }
    }
    if (far > 0) {
      keep[far] = 1;
      stack.push([i, far], [far, j]);
    }
  }
  return pts.filter((_, k) => keep[k]);
}

function walkable(p) {
  if (!p.highway || NOT_WALKABLE.has(p.highway)) return false;
  if (NO.has(p.foot)) return false;
  if (NO.has(p.access) && !FOOT_OK.has(p.foot)) return false;
  if (p.area === 'yes') return false;
  return true;
}

/**
 * Zone lookup for many points: every polygon gets its own bounding box (the official
 * tsunami zone is one feature made of hundreds of polygons spread around the island).
 * Same precedence as the app's ZoneIndex: tsunami, then extreme, then safe.
 */
function zoneLookup(zoneFeatures) {
  const polys = [];
  for (const f of zoneFeatures) {
    const list = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const poly of list)
      polys.push({ kind: f.properties.kind, test: makePolygonTester(poly), bbox: bboxOf([poly]) });
  }
  const order = ['tsunami', 'extreme', 'safe'];
  return (p) => {
    const hits = new Set();
    for (const z of polys) if (inBBox(p, z.bbox) && z.test(p)) hits.add(z.kind);
    return order.find((k) => hits.has(k)) ?? 'none';
  };
}

/**
 * @param {string} rawPath  gzipped GeoJSON lines from osmium export
 * @param {object[]} zoneFeatures  the processed zone features (properties.kind)
 */
export function buildWalkGraph(rawPath, zoneFeatures) {
  const zoneAt = zoneLookup(zoneFeatures);
  const text = gunzipSync(readFileSync(rawPath)).toString('utf8');
  const ways = [];
  for (const line of text.split('\n')) {
    const json = line.replace(/^\x1e/, '').trim();
    if (!json) continue;
    const f = JSON.parse(json);
    if (f.geometry?.type !== 'LineString' || !walkable(f.properties ?? {})) continue;
    ways.push({
      coords: f.geometry.coordinates,
      name: f.properties.name ?? f.properties.ref ?? null,
    });
  }

  // Points shared by ways are the same OSM node, and osmium writes identical coordinates.
  const key = ([x, y]) => `${x.toFixed(7)},${y.toFixed(7)}`;
  const uses = new Map();
  for (const w of ways)
    w.coords.forEach((c, i) => {
      const k = key(c);
      // Way ends always count as nodes (dead ends, or where two ways meet end to end).
      uses.set(k, (uses.get(k) ?? 0) + (i === 0 || i === w.coords.length - 1 ? 2 : 1));
    });

  const nodeIndex = new Map();
  const nodes = [];
  const nodeId = (c) => {
    const k = key(c);
    let id = nodeIndex.get(k);
    if (id === undefined) {
      id = nodes.length;
      nodeIndex.set(k, id);
      nodes.push(c);
    }
    return id;
  };

  const names = [];
  const nameIndex = new Map();
  const nameId = (n) => {
    if (!n) return -1;
    let id = nameIndex.get(n);
    if (id === undefined) {
      id = names.length;
      nameIndex.set(n, id);
      names.push(n);
    }
    return id;
  };

  const edges = [];
  for (const w of ways) {
    let start = 0;
    for (let i = 1; i < w.coords.length; i++) {
      if (i < w.coords.length - 1 && (uses.get(key(w.coords[i])) ?? 0) < 2) continue;
      const pts = w.coords.slice(start, i + 1);
      let len = 0;
      for (let j = 1; j < pts.length; j++) len += distanceMeters(pts[j - 1], pts[j]);
      const a = nodeId(pts[0]);
      const b = nodeId(pts[pts.length - 1]);
      if (a !== b || len > 0)
        edges.push({ a, b, len, name: nameId(w.name), shape: simplify(pts).slice(1, -1) });
      start = i;
    }
  }

  // Largest connected component (union-find).
  const parent = Int32Array.from(nodes, (_, i) => i);
  const find = (x) => {
    while (parent[x] !== x) x = parent[x] = parent[parent[x]];
    return x;
  };
  for (const e of edges) parent[find(e.a)] = find(e.b);
  const size = new Map();
  for (let i = 0; i < nodes.length; i++) size.set(find(i), (size.get(find(i)) ?? 0) + 1);
  const main = [...size.entries()].sort((x, y) => y[1] - x[1])[0][0];

  const keepNode = new Int32Array(nodes.length).fill(-1);
  const kept = [];
  for (let i = 0; i < nodes.length; i++)
    if (find(i) === main) {
      keepNode[i] = kept.length;
      kept.push(nodes[i]);
    }
  const keptEdges = edges.filter((e) => keepNode[e.a] >= 0);

  const nodeZone = new Uint8Array(kept.length);
  kept.forEach((c, i) => {
    nodeZone[i] = ZONE_CODE[zoneAt(c)];
  });

  const nS = keptEdges.reduce((n, e) => n + e.shape.length, 0);
  const g = {
    nodeLng: Float64Array.from(kept, (c) => c[0]),
    nodeLat: Float64Array.from(kept, (c) => c[1]),
    nodeZone,
    edgeA: Uint32Array.from(keptEdges, (e) => keepNode[e.a]),
    edgeB: Uint32Array.from(keptEdges, (e) => keepNode[e.b]),
    edgeLen: Float32Array.from(keptEdges, (e) => e.len),
    edgeName: Int32Array.from(keptEdges, (e) => e.name),
    shapeStart: new Uint32Array(keptEdges.length),
    shapeCount: new Uint32Array(keptEdges.length),
    shapeLng: new Float64Array(nS),
    shapeLat: new Float64Array(nS),
  };
  let s = 0;
  keptEdges.forEach((e, i) => {
    g.shapeStart[i] = s;
    g.shapeCount[i] = e.shape.length;
    for (const [x, y] of e.shape) {
      g.shapeLng[s] = x;
      g.shapeLat[s] = y;
      s++;
    }
  });

  // Names used by kept edges only.
  const usedNames = [...new Set(g.edgeName)].filter((n) => n >= 0).sort((a, b) => a - b);
  const remap = new Map(usedNames.map((n, i) => [n, i]));
  g.edgeName = Int32Array.from(g.edgeName, (n) => (n < 0 ? -1 : remap.get(n)));

  /** Nearest graph node to a point (brute force; only used for a few dozen refuges). */
  const nearestNode = (p) => {
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < kept.length; i++) {
      const d = distanceMeters(p, kept[i]);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return { node: best, distance: bestD };
  };

  return {
    buffer: encodeWalkGraph(g),
    names: usedNames.map((n) => names[n]),
    nearestNode,
    stats: {
      ways: ways.length,
      nodes: kept.length,
      droppedNodes: nodes.length - kept.length,
      edges: keptEdges.length,
      shapePoints: nS,
      km: Math.round(keptEdges.reduce((n, e) => n + e.len, 0) / 1000),
    },
  };
}
