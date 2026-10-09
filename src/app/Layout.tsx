import { NavLink, Outlet } from 'react-router';
import { useTranslation } from 'react-i18next';
import { LanguagePicker } from '../components/LanguagePicker';
import { OfflineBanner } from '../components/OfflineBanner';
import { UpdatePrompt } from '../components/UpdatePrompt';

const NAV = [
  { to: '/', key: 'nav.zone', icon: '🌊' },
  { to: '/places', key: 'nav.places', icon: '⛰️' },
  { to: '/alerts', key: 'nav.alerts', icon: '⚠️' },
  { to: '/plan', key: 'nav.plan', icon: '📋' },
] as const;

export function Layout() {
  const { t } = useTranslation();
  return (
    <div className="layout">
      <a className="skip-link" href="#main">
        {t('a11y.skipToContent')}
      </a>
      <header className="app-header">
        <div>
          <p className="app-name">{t('app.name')}</p>
          <p className="app-tagline">{t('app.tagline')}</p>
        </div>
        <LanguagePicker />
      </header>
      <OfflineBanner />
      <UpdatePrompt />
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
      <nav className="tab-bar" aria-label={t('nav.label')}>
        <ul>
          {NAV.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} end>
                <span aria-hidden="true" className="tab-icon">
                  {item.icon}
                </span>
                <span>{t(item.key)}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
