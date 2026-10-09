import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/**
 * Whether the browser thinks it has a network connection. Note: `navigator.onLine`
 * being true does not guarantee the internet is reachable (e.g. Wi-Fi with no uplink),
 * so features that fetch data must still handle failures. False is reliable, though.
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
