/// <reference types="node" />
import { describe, expect, it } from 'vitest';
// A real response from https://api.weather.gov/alerts?area=HI&limit=25, downloaded
// 2026-10-09 by the fetch-data workflow (see DATA_SOURCES.md). Not modified.
import realFeed from '../../../data/raw/nws-recent-hi.json';
import type { AlertSnapshot } from '../../data/db';
import { hasEnded, parseAlert, parseAlerts, type NwsFeed } from './parseAlerts';
import { decodeSnapshot, encodeSnapshot, shareUrl } from './shareCodec';
import { FRESH_MS, STALE_MS, freshness } from './staleness';

// Synthetic test alert (not real data), built from the CAP fields the NWS uses.
const synthetic = (props: Record<string, unknown>) => ({
  id: String(props.id ?? Math.random()),
  properties: {
    id: 'x',
    status: 'Actual',
    messageType: 'Alert',
    event: 'Flood Advisory',
    severity: 'Minor',
    areaDesc: 'Kauai, HI',
    sent: '2026-10-08T10:00:00-10:00',
    ends: '2026-10-08T12:00:00-10:00',
    ...props,
  },
});

describe('parseAlerts (real NWS feed)', () => {
  const alerts = parseAlerts(realFeed as NwsFeed);

  it('drops cancellations and keeps the rest', () => {
    const cancels = (realFeed as NwsFeed).features!.filter(
      (f) => f.properties?.messageType === 'Cancel',
    ).length;
    expect(cancels).toBeGreaterThan(0);
    expect(alerts.length).toBe((realFeed as NwsFeed).features!.length - cancels);
    expect(alerts.every((a) => a.messageType !== 'Cancel')).toBe(true);
  });

  it('flags alerts that mention Oʻahu and sorts them first', () => {
    const oahu = alerts.filter((a) => a.oahu);
    expect(oahu.length).toBeGreaterThan(0);
    expect(oahu.some((a) => a.areaDesc === 'Oahu in Honolulu, HI')).toBe(true);
    expect(alerts.findIndex((a) => !a.oahu)).toBe(oahu.length);
    expect(alerts.find((a) => a.areaDesc === 'Kauai, HI')?.oahu).toBe(false);
  });

  it('keeps the NWS instruction text', () => {
    expect(alerts.some((a) => a.instruction?.includes("Turn around, don't drown"))).toBe(true);
  });
});

describe('parseAlert / sorting (synthetic)', () => {
  it('puts tsunami alerts first, then Oʻahu, then severity', () => {
    const list = parseAlerts({
      features: [
        synthetic({ id: 'a', event: 'Flood Watch', severity: 'Severe', areaDesc: 'Kauai, HI' }),
        synthetic({ id: 'b', event: 'Wind Advisory', severity: 'Minor', areaDesc: 'Central Oahu' }),
        synthetic({
          id: 'c',
          event: 'Tsunami Warning',
          severity: 'Extreme',
          areaDesc: 'Kauai, HI',
        }),
        synthetic({
          id: 'd',
          event: 'High Surf Warning',
          severity: 'Severe',
          areaDesc: 'Waianae Coast',
        }),
      ],
    });
    expect(list.map((a) => a.id)).toEqual(['c', 'd', 'b', 'a']);
    expect(list[0]!.tsunami).toBe(true);
  });

  it('detects Oʻahu by county UGC code too', () => {
    const a = parseAlert(synthetic({ areaDesc: 'Somewhere', geocode: { UGC: ['HIC003'] } }))!;
    expect(a.oahu).toBe(true);
  });

  it('drops test messages and rejects features with no event', () => {
    expect(parseAlerts({ features: [synthetic({ status: 'Test' })] })).toEqual([]);
    expect(parseAlert(synthetic({ event: '' }))).toBeNull();
  });

  it('knows when an alert has ended', () => {
    const a = parseAlert(synthetic({ ends: '2026-10-08T12:00:00-10:00' }))!;
    expect(hasEnded(a, Date.parse('2026-10-08T11:59:00-10:00'))).toBe(false);
    expect(hasEnded(a, Date.parse('2026-10-08T12:00:00-10:00'))).toBe(true);
    const open = parseAlert(synthetic({ ends: null, expires: null }))!;
    expect(hasEnded(open, Date.now())).toBe(false);
  });
});

describe('freshness', () => {
  it('labels age bands', () => {
    const t0 = 1_000_000_000;
    expect(freshness(t0, t0)).toBe('fresh');
    expect(freshness(t0, t0 + FRESH_MS - 1)).toBe('fresh');
    expect(freshness(t0, t0 + FRESH_MS)).toBe('aging');
    expect(freshness(t0, t0 + STALE_MS)).toBe('stale');
    expect(freshness(t0 + 5000, t0)).toBe('fresh'); // clock skew: never negative
  });
});

describe('share codec', () => {
  it('round-trips a real snapshot and fits comfortably in a QR code', async () => {
    const snap: AlertSnapshot = {
      key: 'latest',
      fetchedAt: Date.parse('2026-10-09T10:00:00Z'),
      feedUpdated: null,
      alerts: parseAlerts(realFeed as NwsFeed),
    };
    const code = await encodeSnapshot(snap);
    const url = shareUrl(code, 'https://example.org/');
    expect(url.length).toBeLessThan(1500); // QR version ~30 at low error correction
    const back = await decodeSnapshot(code);
    expect(back.fetchedAt).toBe(snap.fetchedAt);
    expect(back.alerts).toHaveLength(8);
    expect(back.alerts[0]!.event).toBe(snap.alerts[0]!.event);
    expect(back.alerts[0]!.oahu).toBe(snap.alerts[0]!.oahu);
  });

  it('rejects garbage', async () => {
    await expect(decodeSnapshot('not-a-snapshot')).rejects.toThrow();
  });
});
