// Synthetic street grids (not real data) to test the router.
import { describe, expect, it } from 'vitest';
import { compassPoint, distanceMeters } from './distance';
import { WalkGraph } from './route';
import type { LngLat } from './types';
import { decodeWalkGraph, encodeWalkGraph, ZONE_CODE, type WalkGraphData } from './walkGraph';

const D = 0.001; // grid spacing in degrees (~100 m)
const O: LngLat = [-157.85, 21.28];

/**
 * A 4×4 street grid. Rows run east-west ("Row 0".."Row 3", south to north), columns
 * north-south ("Col 0".."Col 3"). Zones are given per node by `zoneAt(col,row)`.
 */
function grid(zoneAt: (c: number, r: number) => number, removeEdges: string[] = []): WalkGraphData {
  const nodeLng: number[] = [];
  const nodeLat: number[] = [];
  const nodeZone: number[] = [];
  const id = (c: number, r: number) => r * 4 + c;
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++) {
      nodeLng.push(O[0] + c * D);
      nodeLat.push(O[1] + r * D);
      nodeZone.push(zoneAt(c, r));
    }
  const names = ['Row 0', 'Row 1', 'Row 2', 'Row 3', 'Col 0', 'Col 1', 'Col 2', 'Col 3'];
  const A: number[] = [];
  const B: number[] = [];
  const name: number[] = [];
  const add = (a: number, b: number, n: number, key: string) => {
    if (removeEdges.includes(key)) return;
    A.push(a);
    B.push(b);
    name.push(n);
  };
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 3; c++) add(id(c, r), id(c + 1, r), r, `h${c}${r}`);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 3; r++) add(id(c, r), id(c, r + 1), 4 + c, `v${c}${r}`);
  const len = A.map((a, i) =>
    distanceMeters([nodeLng[a]!, nodeLat[a]!], [nodeLng[B[i]!]!, nodeLat[B[i]!]!]),
  );
  return {
    nodeLng: Float64Array.from(nodeLng),
    nodeLat: Float64Array.from(nodeLat),
    nodeZone: Uint8Array.from(nodeZone),
    edgeA: Uint32Array.from(A),
    edgeB: Uint32Array.from(B),
    edgeLen: Float32Array.from(len),
    edgeName: Int32Array.from(name),
    shapeStart: new Uint32Array(A.length),
    shapeCount: new Uint32Array(A.length),
    shapeLng: new Float64Array(0),
    shapeLat: new Float64Array(0),
    names,
  };
}

// South two rows are the tsunami zone, north two rows are safe.
const coastal = (_c: number, r: number) => (r <= 1 ? ZONE_CODE.tsunami : ZONE_CODE.safe);

describe('WalkGraph', () => {
  it('snaps a point to the nearest street', () => {
    const g = new WalkGraph(grid(coastal));
    const s = g.snap([O[0] + 0.5 * D, O[1] + 0.0002])!; // just north of Row 0, mid-block
    expect(g.g.names[g.g.edgeName[s.edge]!]).toBe('Row 0');
    expect(s.offset).toBeCloseTo(22, 0);
    expect(s.fromA).toBeCloseTo(52, 0);
  });

  it('refuses to route from far off the network', () => {
    const g = new WalkGraph(grid(coastal));
    expect(g.routeToZone([O[0] - 0.02, O[1]], [ZONE_CODE.safe])).toBeNull();
  });

  it('walks north to the nearest safe intersection', () => {
    const g = new WalkGraph(grid(coastal));
    const start: LngLat = [O[0] + D, O[1] + 0.00005]; // on Col 1, near Row 0
    const r = g.routeToZone(start, [ZONE_CODE.safe])!;
    expect(r.end).toEqual([O[0] + D, O[1] + 2 * D]);
    expect(r.distance).toBeCloseTo(2 * 111.2 - 5.6, -1);
    expect(r.steps).toHaveLength(1);
    expect(r.steps[0]!.street).toBe('Col 1');
    expect(compassPoint(r.steps[0]!.bearing)).toBe('N');
    expect(r.coords[0]).toEqual(start);
  });

  it('goes around a missing street and names the turns', () => {
    // Col 1 between rows 1 and 2 is closed, so from (1,1) the way out is west, then north.
    const g = new WalkGraph(grid(coastal, ['v11', 'v21']));
    const r = g.routeToZone([O[0] + D, O[1] + D], [ZONE_CODE.safe])!;
    expect(r.end).toEqual([O[0], O[1] + 2 * D]);
    expect(r.steps.map((s) => [s.kind, s.street])).toEqual([
      ['depart', 'Row 1'],
      ['right', 'Col 0'],
    ]);
    expect(compassPoint(r.steps[0]!.bearing)).toBe('W');
    // Route length matches the drawn line.
    let drawn = 0;
    for (let i = 1; i < r.coords.length; i++)
      drawn += distanceMeters(r.coords[i - 1]!, r.coords[i]!);
    expect(drawn).toBeCloseTo(r.distance, 0);
  });

  it('merges straight stretches of the same street into one step', () => {
    const g = new WalkGraph(grid((c) => (c === 3 ? ZONE_CODE.safe : ZONE_CODE.tsunami)));
    const r = g.routeToZone([O[0], O[1]], [ZONE_CODE.safe])!;
    expect(r.steps).toHaveLength(1);
    expect(r.steps[0]!.distance).toBeCloseTo(3 * 103.6, -1);
  });

  it('ranks destinations by walking distance, not straight-line distance', () => {
    // With Col 1 cut between rows 0-3, node (1,3) is close as the crow flies from (1,0)
    // but a long walk; node (3,0) is farther in a straight line but a short walk.
    const cut = ['v10', 'v11', 'v12'];
    const g = new WalkGraph(grid(coastal, cut));
    const res = g.routesToNodes([O[0] + D, O[1]], [13, 3], 2)!;
    expect(res[0]!.route.endNode).toBe(3);
    expect(res[1]!.route.endNode).toBe(13);
    expect(res[0]!.index).toBe(1);
  });

  it('survives an encode/decode round trip', () => {
    const data = grid(coastal);
    const back = decodeWalkGraph(encodeWalkGraph(data), data.names);
    expect(Array.from(back.edgeA)).toEqual(Array.from(data.edgeA));
    expect(Array.from(back.nodeZone)).toEqual(Array.from(data.nodeZone));
    expect(back.nodeLng[5]).toBeCloseTo(data.nodeLng[5]!, 6);
    expect(back.edgeLen[3]).toBeCloseTo(data.edgeLen[3]!, 3);
  });
});
