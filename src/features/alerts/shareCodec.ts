import type { AlertSnapshot } from '../../data/db';
import { sortAlerts, type Alert, type Severity } from './parseAlerts';

/**
 * Packs an alert snapshot into a short string that fits in a QR code, so one phone can
 * pass the latest alerts to another with no internet and no server. The QR holds a
 * link to this app with the data after the #, so the other phone's ordinary camera
 * app can open it, and the app's service worker serves it offline.
 *
 * Only a summary travels (event, severity, area, end time): full NWS text is far too
 * long for a QR code.
 */
export type SharedSnapshot = {
  /** When the sharing phone downloaded the alerts from the NWS (ms since epoch). */
  fetchedAt: number;
  alerts: Pick<Alert, 'event' | 'severity' | 'areaDesc' | 'ends' | 'oahu' | 'tsunami'>[];
};

const VERSION = 1;
const MAX_ALERTS = 8;
const MAX_AREA = 120;
const SEV: Severity[] = ['Extreme', 'Severe', 'Moderate', 'Minor', 'Unknown'];

type Packed = [
  version: number,
  fetchedAtSeconds: number,
  alerts: [event: string, sev: number, area: string, endsSeconds: number, flags: number][],
];

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function pipe(
  bytes: Uint8Array<ArrayBuffer>,
  stream: CompressionStream | DecompressionStream,
) {
  const out = new Response(bytes).body!.pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export async function encodeSnapshot(snapshot: AlertSnapshot): Promise<string> {
  const packed: Packed = [
    VERSION,
    Math.round(snapshot.fetchedAt / 1000),
    sortAlerts(snapshot.alerts)
      .slice(0, MAX_ALERTS)
      .map((a) => [
        a.event,
        SEV.indexOf(a.severity),
        a.areaDesc.length > MAX_AREA ? `${a.areaDesc.slice(0, MAX_AREA - 1)}…` : a.areaDesc,
        a.ends ? Math.round(Date.parse(a.ends) / 1000) : 0,
        (a.oahu ? 1 : 0) | (a.tsunami ? 2 : 0),
      ]),
  ];
  const json = new TextEncoder().encode(JSON.stringify(packed));
  return toBase64Url(await pipe(json, new CompressionStream('deflate-raw')));
}

/** Throws if the string is damaged or not a Kōkua snapshot. */
export async function decodeSnapshot(code: string): Promise<SharedSnapshot> {
  const json = await pipe(fromBase64Url(code), new DecompressionStream('deflate-raw'));
  const packed = JSON.parse(new TextDecoder().decode(json)) as Packed;
  if (!Array.isArray(packed) || packed[0] !== VERSION || !Array.isArray(packed[2]))
    throw new Error('Not a Kōkua alert snapshot');
  return {
    fetchedAt: packed[1] * 1000,
    alerts: packed[2].map(([event, sev, area, ends, flags]) => ({
      event: String(event),
      severity: SEV[sev] ?? 'Unknown',
      areaDesc: String(area),
      ends: ends ? new Date(ends * 1000).toISOString() : null,
      oahu: (flags & 1) !== 0,
      tsunami: (flags & 2) !== 0,
    })),
  };
}

/** The full link to put in the QR code. */
export function shareUrl(code: string, base: string = window.location.href): string {
  const url = new URL(import.meta.env.BASE_URL, base);
  url.hash = `/shared?d=${code}`;
  return url.href;
}
