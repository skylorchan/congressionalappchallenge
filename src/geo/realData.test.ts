/// <reference types="node" />
// Checks the geo code against the real, processed zone data (public/data/zones.json,
// produced by `npm run data:build`). Skipped if that file hasn't been built.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { LngLat } from './types';
import { nearestExit } from './nearest';
import { ZoneIndex, type ZoneCollection, type ZoneStatus } from './zoneLookup';

const path = join(process.cwd(), 'public/data/zones.json');

describe.skipIf(!existsSync(path))('real Oʻahu zone data', () => {
  const idx = ZoneIndex.fromGeoJSON(JSON.parse(readFileSync(path, 'utf8')) as ZoneCollection);

  it.each<[string, LngLat, ZoneStatus]>([
    ['Waikīkī Beach', [-157.8268, 21.276], 'tsunami'],
    ['Haleʻiwa town', [-158.103, 21.592], 'tsunami'],
    ['Aloha Tower', [-157.8663, 21.3069], 'tsunami'],
    ['UH Mānoa', [-157.817, 21.2969], 'safe'],
    ['Mililani', [-158.01, 21.45], 'safe'],
    ['open ocean off Diamond Head', [-157.85, 21.25], 'no-data'],
  ])('%s → %s', (_, point, status) => {
    expect(idx.lookup(point).status).toBe(status);
  });

  it('finds a way out of the tsunami zone from Waikīkī that lands on mapped ground', () => {
    const origin: LngLat = [-157.8268, 21.276];
    const reach = [...idx.ofKind('extreme'), ...idx.ofKind('safe')];
    const exit = nearestExit(origin, idx.ofKind('tsunami'), reach)!;
    expect(exit.distance).toBeGreaterThan(100);
    expect(exit.distance).toBeLessThan(3000);
    // Nudge 5 m past the exit point along the same line: that must be extreme or safe.
    const k = (exit.distance + 5) / exit.distance;
    const beyond: LngLat = [
      origin[0] + (exit.point[0] - origin[0]) * k,
      origin[1] + (exit.point[1] - origin[1]) * k,
    ];
    expect(['extreme', 'safe']).toContain(idx.lookup(beyond).status);
  });

  it('for an extreme warning, the way out from Waikīkī reaches a safe zone', () => {
    const origin: LngLat = [-157.8268, 21.276];
    const leave = [...idx.ofKind('tsunami'), ...idx.ofKind('extreme')];
    const exit = nearestExit(origin, leave, idx.ofKind('safe'))!;
    const k = (exit.distance + 5) / exit.distance;
    const beyond: LngLat = [
      origin[0] + (exit.point[0] - origin[0]) * k,
      origin[1] + (exit.point[1] - origin[1]) * k,
    ];
    expect(idx.lookup(beyond).status).toBe('safe');
  });
});
