import { lazy, Suspense, type ReactNode } from 'react';
import { HashRouter, Route, Routes } from 'react-router';
import { Layout } from './app/Layout';
import { LocationProvider } from './app/location';
import { SettingsProvider, useSettings } from './app/settings';
import { ZoneScreen } from './features/zone/ZoneScreen';

// The zone check is the first screen, so it's in the main bundle. The rest load on
// demand (the service worker has already cached them, so this works offline too).
const PlacesScreen = lazy(() =>
  import('./features/places/PlacesScreen').then((m) => ({ default: m.PlacesScreen })),
);
const AlertsScreen = lazy(() =>
  import('./features/alerts/AlertsScreen').then((m) => ({ default: m.AlertsScreen })),
);
const SharedAlertsScreen = lazy(() =>
  import('./features/alerts/SharedAlertsScreen').then((m) => ({ default: m.SharedAlertsScreen })),
);
const PlanScreen = lazy(() =>
  import('./features/plan/PlanScreen').then((m) => ({ default: m.PlanScreen })),
);
const SettingsScreen = lazy(() =>
  import('./features/settings/SettingsScreen').then((m) => ({ default: m.SettingsScreen })),
);
const KupunaScreen = lazy(() =>
  import('./features/kupuna/KupunaScreen').then((m) => ({ default: m.KupunaScreen })),
);

const page = (el: ReactNode) => <Suspense fallback={null}>{el}</Suspense>;

/** In kūpuna mode the home screen is the one-screen simple view. */
function Home() {
  const { settings } = useSettings();
  return settings.kupuna ? page(<KupunaScreen />) : <ZoneScreen />;
}

// Hash URLs (/#/places) so the app needs no server rewrites on any static host. The part
// after # never reaches the server, so deep links (including the alert-sharing QR links)
// always work, online or off.
export function App() {
  return (
    <SettingsProvider>
      <LocationProvider>
        <HashRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="zone" element={<ZoneScreen />} />
              <Route path="places" element={page(<PlacesScreen />)} />
              <Route path="alerts" element={page(<AlertsScreen />)} />
              <Route path="shared" element={page(<SharedAlertsScreen />)} />
              <Route path="plan" element={page(<PlanScreen />)} />
              <Route path="settings" element={page(<SettingsScreen />)} />
              <Route path="*" element={<Home />} />
            </Route>
          </Routes>
        </HashRouter>
      </LocationProvider>
    </SettingsProvider>
  );
}
