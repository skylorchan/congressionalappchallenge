import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet, useLocation as useRoute } from 'react-router';
import { LanguagePicker } from '../components/LanguagePicker';
import { OfflineBanner } from '../components/OfflineBanner';
import { TranslationNotice } from '../components/TranslationNotice';
import { UpdatePrompt } from '../components/UpdatePrompt';
import { CheckInBanner } from '../features/checkin/CheckInCard';
import { useSettings } from './settings';

const NAV = [
  { to: '/zone', key: 'nav.zone', icon: '🌊' },
  { to: '/places', key: 'nav.places', icon: '⛰️' },
  { to: '/alerts', key: 'nav.alerts', icon: '⚠️' },
  { to: '/plan', key: 'nav.plan', icon: '📋' },
] as const;

export function Layout() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const { pathname } = useRoute();
  return (
    <div className={`layout${settings.kupuna ? ' layout-kupuna' : ''}`}>
      <a className="skip-link" href="#main">
        {t('a11y.skipToContent')}
      </a>
      <header className="app-header">
        <Link to="/" className="app-title">
          <span className="app-name">{t('app.name')}</span>
          <span className="app-tagline">{t('app.tagline')}</span>
        </Link>
        <div className="header-tools">
          <LanguagePicker />
          <Link to="/settings" className="header-link">
            <span aria-hidden="true">⚙️ </span>
            {t('nav.settings')}
          </Link>
        </div>
      </header>
      <OfflineBanner />
      <TranslationNotice />
      <UpdatePrompt />
      <CheckInBanner />
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
      {!settings.kupuna && (
        <nav className="tab-bar" aria-label={t('nav.label')}>
          <ul>
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  // The home screen is the zone check, so "/" also lights up "Zone".
                  className={({ isActive }) =>
                    isActive || (item.to === '/zone' && pathname === '/') ? 'active' : ''
                  }
                >
                  <span aria-hidden="true" className="tab-icon">
                    {item.icon}
                  </span>
                  <span>{t(item.key)}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
