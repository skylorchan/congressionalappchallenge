import { useCallback, useEffect, useRef, useState } from 'react';
import { useOnlineStatus } from '../../app/useOnlineStatus';
import { db, type AlertSnapshot } from '../../data/db';
import { parseAlerts, type NwsFeed } from './parseAlerts';

/** Active watches, warnings and advisories for the State of Hawaiʻi. Free, no API key. */
export const NWS_ALERTS_URL = 'https://api.weather.gov/alerts/active?area=HI';
const AUTO_REFRESH_MS = 5 * 60_000;

export async function fetchAlerts(fetchImpl: typeof fetch = fetch): Promise<AlertSnapshot> {
  const res = await fetchImpl(NWS_ALERTS_URL, {
    headers: { Accept: 'application/geo+json' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`NWS returned HTTP ${res.status}`);
  const feed = (await res.json()) as NwsFeed;
  return {
    key: 'latest',
    fetchedAt: Date.now(),
    feedUpdated: feed.updated ?? null,
    alerts: parseAlerts(feed),
  };
}

export async function loadSnapshot(): Promise<AlertSnapshot | null> {
  return (await db.alertSnapshots.get('latest')) ?? null;
}

/**
 * The alert list: shows the saved snapshot immediately (works offline), then refreshes
 * from the NWS when online, and again every 5 minutes while the app is open.
 */
export function useAlerts() {
  const online = useOnlineStatus();
  const [snapshot, setSnapshot] = useState<AlertSnapshot | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setRefreshing(true);
    try {
      const snap = await fetchAlerts();
      await db.alertSnapshots.put(snap);
      setSnapshot(snap);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      busy.current = false;
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let live = true;
    loadSnapshot()
      .then((s) => live && setSnapshot(s))
      .catch(() => {})
      .finally(() => live && setLoaded(true));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!online) return;
    // Refresh right away when the screen opens or the connection comes back (deferred a
    // tick so it isn't a synchronous state change inside the effect).
    const first = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, AUTO_REFRESH_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [online, refresh]);

  return { snapshot, loaded, refreshing, error, refresh, online };
}
