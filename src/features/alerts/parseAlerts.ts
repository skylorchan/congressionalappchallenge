/**
 * Turns the National Weather Service alert feed (api.weather.gov, GeoJSON / CAP fields)
 * into the small shape Kōkua stores and shows. Pure functions, no network.
 */

export type Severity = 'Extreme' | 'Severe' | 'Moderate' | 'Minor' | 'Unknown';

export type Alert = {
  id: string;
  event: string;
  severity: Severity;
  urgency: string;
  headline: string | null;
  description: string;
  instruction: string | null;
  areaDesc: string;
  sent: string;
  /** When the hazard ends, else when the message expires. ISO timestamp, or null. */
  ends: string | null;
  messageType: string;
  senderName: string;
  /** The alert names Oʻahu or one of its NWS forecast zones. */
  oahu: boolean;
  tsunami: boolean;
};

type NwsFeature = {
  id?: string;
  properties?: Record<string, unknown>;
};
export type NwsFeed = { features?: NwsFeature[]; updated?: string };

const SEVERITIES: Severity[] = ['Extreme', 'Severe', 'Moderate', 'Minor', 'Unknown'];

// Honolulu County, plus the names of Oʻahu's NWS forecast zones as they appear in
// `areaDesc` ("Waianae Coast; Oahu North Shore; Olomana; Central Oahu; …").
const OAHU_UGC = 'HIC003';
const OAHU_AREA = /\b(oahu|oʻahu|honolulu|waianae|waiʻanae|olomana|ewa|koolau)\b/i;

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

export function parseAlert(f: NwsFeature): Alert | null {
  const p = f.properties ?? {};
  const event = str(p.event);
  const id = str(p.id) ?? str(f.id);
  if (!event || !id) return null;
  const severity = SEVERITIES.includes(p.severity as Severity)
    ? (p.severity as Severity)
    : 'Unknown';
  const areaDesc = str(p.areaDesc) ?? '';
  const ugc = ((p.geocode as { UGC?: unknown } | undefined)?.UGC ?? []) as unknown[];
  return {
    id,
    event,
    severity,
    urgency: str(p.urgency) ?? 'Unknown',
    headline: str(p.headline),
    description: str(p.description) ?? '',
    instruction: str(p.instruction),
    areaDesc,
    sent: str(p.sent) ?? str(p.effective) ?? '',
    ends: str(p.ends) ?? str(p.expires),
    messageType: str(p.messageType) ?? 'Alert',
    senderName: str(p.senderName) ?? 'National Weather Service',
    oahu: ugc.includes(OAHU_UGC) || OAHU_AREA.test(areaDesc),
    tsunami: /tsunami/i.test(event),
  };
}

/**
 * Parses a feed into a sorted list of current alerts. Cancellations and test messages
 * are dropped. Order: tsunami first, then Oʻahu, then by severity, then newest.
 */
export function parseAlerts(feed: NwsFeed): Alert[] {
  const alerts = (feed.features ?? [])
    .filter((f) => {
      const p = f.properties ?? {};
      return p.status === 'Actual' && p.messageType !== 'Cancel';
    })
    .map(parseAlert)
    .filter((a): a is Alert => a !== null);
  return sortAlerts(alerts);
}

export function sortAlerts(alerts: Alert[]): Alert[] {
  return [...alerts].sort(
    (a, b) =>
      Number(b.tsunami) - Number(a.tsunami) ||
      Number(b.oahu) - Number(a.oahu) ||
      SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity) ||
      b.sent.localeCompare(a.sent),
  );
}

/** True once the alert's end/expiry time has passed. Alerts with no end time never expire. */
export function hasEnded(alert: Alert, now: number = Date.now()): boolean {
  return alert.ends !== null && Date.parse(alert.ends) <= now;
}
