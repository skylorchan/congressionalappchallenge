import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { LngLat } from '../geo/types';

export type LocationSource = 'gps' | 'map' | 'home';
export type UserLocation = {
  coord: LngLat;
  source: LocationSource;
  /** GPS accuracy radius in metres, if known. */
  accuracy?: number;
  /** When the location was set (ms since epoch). */
  at: number;
};
export type GpsState = 'idle' | 'locating' | 'denied' | 'unavailable' | 'timeout' | 'unsupported';

type LocationContextValue = {
  location: UserLocation | null;
  setLocation: (coord: LngLat, source: LocationSource) => void;
  /** Ask the device for a GPS fix. GPS needs no internet, so this works offline. */
  locate: () => void;
  gps: GpsState;
};

const STORAGE_KEY = 'kokua.lastLocation';

function readSaved(): UserLocation | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as UserLocation;
    return Array.isArray(v.coord) && v.coord.length === 2 ? v : null;
  } catch {
    return null;
  }
}

function save(loc: UserLocation) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
  } catch {
    /* storage blocked: the location just won't be remembered */
  }
}

const LocationContext = createContext<LocationContextValue | null>(null);

/**
 * The location every screen checks against. It lives only on this device (localStorage),
 * and is remembered so that reopening the app offline still shows the last result.
 */
export function LocationProvider({ children }: { children: ReactNode }) {
  const [location, setLoc] = useState<UserLocation | null>(readSaved);
  const [gps, setGps] = useState<GpsState>('idle');

  const update = useCallback((loc: UserLocation) => {
    setLoc(loc);
    save(loc);
  }, []);

  const setLocation = useCallback(
    (coord: LngLat, source: LocationSource) => update({ coord, source, at: Date.now() }),
    [update],
  );

  const locate = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setGps('unsupported');
      return;
    }
    setGps('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps('idle');
        update({
          coord: [pos.coords.longitude, pos.coords.latitude],
          source: 'gps',
          accuracy: pos.coords.accuracy,
          at: pos.timestamp || Date.now(),
        });
      },
      (err) => {
        setGps(
          err.code === err.PERMISSION_DENIED
            ? 'denied'
            : err.code === err.TIMEOUT
              ? 'timeout'
              : 'unavailable',
        );
      },
      // A cold GPS fix with no network assistance can take a while; don't give up early.
      { enableHighAccuracy: true, timeout: 30_000, maximumAge: 60_000 },
    );
  }, [update]);

  const value = useMemo(
    () => ({ location, setLocation, locate, gps }),
    [location, setLocation, locate, gps],
  );
  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocation must be used inside <LocationProvider>');
  return ctx;
}
