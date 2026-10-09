import { bearingDegrees, distanceMeters, makeLocalProjection } from './distance';
import type { LngLat } from './types';
import type { WalkGraphData } from './walkGraph';

export type StepKind = 'depart' | 'left' | 'right' | 'continue';

export type RouteStep = {
  kind: StepKind;
  /** Street or path name, or null for an unnamed path. */
  street: string | null;
  /** Metres walked on this street before the next turn. */
  distance: number;
  /** Compass bearing at the start of the step (used for "head northeast"). */
  bearing: number;
};

export type Route = {
  /** Total walking distance in metres, including the bit from you to the nearest path. */
  distance: number;
  /** The line to draw: from you, along roads and paths, to the destination. */
  coords: LngLat[];
  steps: RouteStep[];
  /** Graph node where the route ends. */
  endNode: number;
  end: LngLat;
};

type Snap = {
  edge: number;
  /** Index of the edge segment the point is on (between polyline points seg and seg+1). */
  seg: number;
  point: LngLat;
  /** Metres from the query point to the path. */
  offset: number;
  /** Metres along the edge from its A end / to its B end. */
  fromA: number;
  toB: number;
};

/** How far from a road or path a point can be and still get a route (beaches, parks). */
const MAX_SNAP_M = 400;
/** Grid cell size for the snapping index, in degrees (~220 m). */
const CELL = 0.002;
/** Turns smaller than this (degrees) count as carrying straight on. */
const STRAIGHT_DEG = 35;

/** Min-heap of (cost, node) pairs, for Dijkstra. */
class Heap {
  private cost: number[] = [];
  private node: number[] = [];
  get size() {
    return this.cost.length;
  }
  push(c: number, n: number) {
    const { cost, node } = this;
    let i = cost.length;
    cost.push(c);
    node.push(n);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (cost[p]! <= c) break;
      cost[i] = cost[p]!;
      node[i] = node[p]!;
      i = p;
    }
    cost[i] = c;
    node[i] = n;
  }
  pop(): [number, number] {
    const { cost, node } = this;
    const top: [number, number] = [cost[0]!, node[0]!];
    const lc = cost.pop()!;
    const ln = node.pop()!;
    const n = cost.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        if (l >= n) break;
        const r = l + 1;
        const m = r < n && cost[r]! < cost[l]! ? r : l;
        if (cost[m]! >= lc) break;
        cost[i] = cost[m]!;
        node[i] = node[m]!;
        i = m;
      }
      cost[i] = lc;
      node[i] = ln;
    }
    return top;
  }
}

export class WalkGraph {
  readonly g: WalkGraphData;
  private adjStart: Uint32Array;
  private adjEdge: Uint32Array;
  private grid = new Map<number, number[]>(); // cell -> [edge, seg, edge, seg, …]

  constructor(g: WalkGraphData) {
    this.g = g;
    const nN = g.nodeLng.length;
    const nE = g.edgeA.length;
    // Adjacency in compressed form: edges touching node i are adjEdge[adjStart[i]..adjStart[i+1]).
    const deg = new Uint32Array(nN + 1);
    for (let e = 0; e < nE; e++) {
      deg[g.edgeA[e]! + 1]!++;
      deg[g.edgeB[e]! + 1]!++;
    }
    for (let i = 0; i < nN; i++) deg[i + 1]! += deg[i]!;
    this.adjStart = deg;
    this.adjEdge = new Uint32Array(2 * nE);
    const fill = deg.slice(0, nN);
    for (let e = 0; e < nE; e++) {
      this.adjEdge[fill[g.edgeA[e]!]!++] = e;
      this.adjEdge[fill[g.edgeB[e]!]!++] = e;
    }
    // Spatial index of every segment, for snapping a GPS point onto the network.
    for (let e = 0; e < nE; e++) {
      const pts = this.polyline(e);
      for (let s = 0; s + 1 < pts.length; s++) {
        const [x1, y1] = pts[s]!;
        const [x2, y2] = pts[s + 1]!;
        const cx0 = Math.floor(Math.min(x1, x2) / CELL);
        const cx1 = Math.floor(Math.max(x1, x2) / CELL);
        const cy0 = Math.floor(Math.min(y1, y2) / CELL);
        const cy1 = Math.floor(Math.max(y1, y2) / CELL);
        for (let cx = cx0; cx <= cx1; cx++)
          for (let cy = cy0; cy <= cy1; cy++) {
            const k = cellKey(cx, cy);
            const list = this.grid.get(k);
            if (list) list.push(e, s);
            else this.grid.set(k, [e, s]);
          }
      }
    }
  }

  get nodeCount() {
    return this.g.nodeLng.length;
  }

  node(i: number): LngLat {
    return [this.g.nodeLng[i]!, this.g.nodeLat[i]!];
  }

  /** The edge's full line, from its A node to its B node. */
  polyline(e: number): LngLat[] {
    const { g } = this;
    const out: LngLat[] = [this.node(g.edgeA[e]!)];
    const s0 = g.shapeStart[e]!;
    for (let i = 0; i < g.shapeCount[e]!; i++) out.push([g.shapeLng[s0 + i]!, g.shapeLat[s0 + i]!]);
    out.push(this.node(g.edgeB[e]!));
    return out;
  }

  /** Nearest point on any road or path, within MAX_SNAP_M. */
  snap(p: LngLat): Snap | null {
    const proj = makeLocalProjection(p);
    const cx = Math.floor(p[0] / CELL);
    const cy = Math.floor(p[1] / CELL);
    const cellM = CELL * 101_000; // smallest side of a cell in metres at Oʻahu's latitude
    let best: { d: number; e: number; s: number; t: number } | null = null;
    const seen = new Set<number>();
    for (let r = 0; r * cellM <= MAX_SNAP_M + cellM; r++) {
      // Once the nearest hit is closer than this ring can be, stop looking.
      if (best && best.d < (r - 1) * cellM) break;
      for (let ix = cx - r; ix <= cx + r; ix++)
        for (let iy = cy - r; iy <= cy + r; iy++) {
          if (Math.max(Math.abs(ix - cx), Math.abs(iy - cy)) !== r) continue;
          const list = this.grid.get(cellKey(ix, iy));
          if (!list) continue;
          for (let i = 0; i < list.length; i += 2) {
            const e = list[i]!;
            const s = list[i + 1]!;
            const key = e * 65_536 + s;
            if (seen.has(key)) continue;
            seen.add(key);
            const pts = this.polyline(e);
            const [ax, ay] = proj.toXY(pts[s]!);
            const [bx, by] = proj.toXY(pts[s + 1]!);
            const dx = bx - ax;
            const dy = by - ay;
            const len2 = dx * dx + dy * dy;
            const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
            const d = Math.hypot(ax + t * dx, ay + t * dy);
            if (!best || d < best.d) best = { d, e, s, t };
          }
        }
    }
    if (!best || best.d > MAX_SNAP_M) return null;
    const pts = this.polyline(best.e);
    const a = pts[best.s]!;
    const b = pts[best.s + 1]!;
    const point: LngLat = [a[0] + (b[0] - a[0]) * best.t, a[1] + (b[1] - a[1]) * best.t];
    let fromA = distanceMeters(a, point);
    for (let i = 0; i < best.s; i++) fromA += distanceMeters(pts[i]!, pts[i + 1]!);
    const len = this.g.edgeLen[best.e]!;
    return {
      edge: best.e,
      seg: best.s,
      point,
      offset: best.d,
      fromA: Math.min(fromA, len),
      toB: Math.max(0, len - fromA),
    };
  }

  /**
   * Shortest walk from `origin` to the nearest node that `isTarget` accepts (or any of
   * them, if `all` is set, for ranking several destinations). Returns per-node costs and
   * the edge used to reach each node, for rebuilding paths.
   */
  private search(
    snap: Snap,
    isTarget: (node: number) => boolean,
    maxM: number,
    stopAtFirst: boolean,
    remaining = Infinity,
  ) {
    const n = this.nodeCount;
    const dist = new Float64Array(n).fill(Infinity);
    const pred = new Int32Array(n).fill(-1);
    const done = new Uint8Array(n);
    const heap = new Heap();
    const { g } = this;
    const a = g.edgeA[snap.edge]!;
    const b = g.edgeB[snap.edge]!;
    dist[a] = snap.offset + snap.fromA;
    dist[b] = Math.min(dist[b]!, snap.offset + snap.toB);
    heap.push(dist[a]!, a);
    heap.push(dist[b]!, b);
    let first = -1;
    let left = remaining;
    while (heap.size) {
      const [c, u] = heap.pop();
      if (done[u] || c > dist[u]!) continue;
      if (c > maxM) break;
      done[u] = 1;
      if (isTarget(u)) {
        if (first < 0) first = u;
        if (stopAtFirst || --left <= 0) break;
      }
      for (let k = this.adjStart[u]!; k < this.adjStart[u + 1]!; k++) {
        const e = this.adjEdge[k]!;
        const v = g.edgeA[e] === u ? g.edgeB[e]! : g.edgeA[e]!;
        const nc = c + g.edgeLen[e]!;
        if (nc < dist[v]!) {
          dist[v] = nc;
          pred[v] = e;
          heap.push(nc, v);
        }
      }
    }
    return { dist, pred, first };
  }

  /** Builds the drawable route and turn-by-turn steps from the search result. */
  private build(
    origin: LngLat,
    snap: Snap,
    pred: Int32Array,
    dist: Float64Array,
    end: number,
  ): Route {
    const { g } = this;
    // Walk back from the destination to whichever end of the snapped edge we started at.
    const edges: { e: number; from: number }[] = [];
    let cur = end;
    while (pred[cur]! >= 0) {
      const e = pred[cur]!;
      const from = g.edgeA[e] === cur ? g.edgeB[e]! : g.edgeA[e]!;
      edges.push({ e, from });
      cur = from;
    }
    edges.reverse();
    const startNode = cur; // an end of the snapped edge

    // First leg: from you to the path, then along the snapped edge to startNode.
    const pts = this.polyline(snap.edge);
    const towardA = startNode === g.edgeA[snap.edge];
    const firstLeg: LngLat[] = [origin, snap.point];
    if (towardA) for (let i = snap.seg; i >= 0; i--) firstLeg.push(pts[i]!);
    else for (let i = snap.seg + 1; i < pts.length; i++) firstLeg.push(pts[i]!);

    type Leg = { name: number; coords: LngLat[]; length: number };
    const legs: Leg[] = [
      {
        name: g.edgeName[snap.edge]!,
        coords: firstLeg.slice(1),
        length: towardA ? snap.fromA : snap.toB,
      },
    ];
    for (const { e, from } of edges) {
      const line = this.polyline(e);
      if (g.edgeA[e] !== from) line.reverse();
      legs.push({ name: g.edgeName[e]!, coords: line, length: g.edgeLen[e]! });
    }

    const coords: LngLat[] = [
      origin,
      ...legs.flatMap((l, i) => (i === 0 ? l.coords : l.coords.slice(1))),
    ];

    // Merge consecutive legs on the same street into steps, and name the turn between them.
    const steps: RouteStep[] = [];
    for (let li = 0; li < legs.length; li++) {
      const leg = legs[li]!;
      if (leg.length < 0.5 && leg.coords.length < 2) continue;
      const prev = steps.at(-1);
      const name = leg.name >= 0 ? g.names[leg.name]! : null;
      if (prev && prev.street === name) {
        prev.distance += leg.length;
        continue;
      }
      const startBearing = bearingDegrees(
        leg.coords[0]!,
        leg.coords[Math.min(1, leg.coords.length - 1)]!,
      );
      let kind: StepKind = 'depart';
      if (prev) {
        const pc = legs[li - 1]!.coords;
        const inBearing = bearingDegrees(pc[Math.max(0, pc.length - 2)]!, pc[pc.length - 1]!);
        const turn = ((startBearing - inBearing + 540) % 360) - 180;
        kind = Math.abs(turn) < STRAIGHT_DEG ? 'continue' : turn > 0 ? 'right' : 'left';
      }
      steps.push({ kind, street: name, distance: leg.length, bearing: startBearing });
    }
    if (steps[0]) steps[0].distance += snap.offset;

    return { distance: dist[end]!, coords, steps, endNode: end, end: this.node(end) };
  }

  /** Shortest walking route to the nearest node in one of the given zones. */
  routeToZone(origin: LngLat, zoneCodes: readonly number[], maxM = 25_000): Route | null {
    const snap = this.snap(origin);
    if (!snap) return null;
    const want = new Set(zoneCodes);
    const { pred, dist, first } = this.search(
      snap,
      (u) => want.has(this.g.nodeZone[u]!),
      maxM,
      true,
    );
    return first < 0 ? null : this.build(origin, snap, pred, dist, first);
  }

  /**
   * Walking routes to several destination nodes, shortest first (one search for all of
   * them). Destinations that can't be reached within maxM are left out.
   */
  routesToNodes(origin: LngLat, nodes: readonly number[], k: number, maxM = 30_000) {
    const snap = this.snap(origin);
    if (!snap) return null;
    const targets = new Set(nodes);
    const { pred, dist } = this.search(snap, (u) => targets.has(u), maxM, false, targets.size);
    return nodes
      .map((node, index) => ({ index, node, d: dist[node]! }))
      .filter((x) => Number.isFinite(x.d))
      .sort((a, b) => a.d - b.d)
      .slice(0, k)
      .map((x) => ({ index: x.index, route: this.build(origin, snap, pred, dist, x.node) }));
  }
}

function cellKey(cx: number, cy: number) {
  // Cells around Oʻahu: cx ≈ -79 150…-78 800, cy ≈ 10 600…10 900. Unique for |c| < 1e5.
  return cx * 200_003 + cy;
}
