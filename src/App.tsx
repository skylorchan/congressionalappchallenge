import { HashRouter, Route, Routes } from 'react-router';
import { Layout } from './app/Layout';
import { LocationProvider } from './app/location';
import { ZoneScreen } from './features/zone/ZoneScreen';
import { PlacesScreen } from './features/places/PlacesScreen';
import { AlertsScreen } from './features/alerts/AlertsScreen';
import { PlanScreen } from './features/plan/PlanScreen';

// Hash URLs (/congressionalappchallenge/#/places) because GitHub Pages can't rewrite unknown paths to
// index.html. The part after # never reaches the server, so deep links always work.
export function App() {
  return (
    <LocationProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<ZoneScreen />} />
            <Route path="places" element={<PlacesScreen />} />
            <Route path="alerts" element={<AlertsScreen />} />
            <Route path="plan" element={<PlanScreen />} />
            <Route path="*" element={<ZoneScreen />} />
          </Route>
        </Routes>
      </HashRouter>
    </LocationProvider>
  );
}
