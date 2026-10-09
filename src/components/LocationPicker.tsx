import { useTranslation } from 'react-i18next';
import { useLocation } from '../app/location';
import { formatDistance, formatTime } from '../lib/format';

/**
 * "Use my location" button plus a line saying which location is being checked and how
 * it was set. GPS works without internet; tapping the map is the fallback when GPS is
 * off or indoors.
 */
export function LocationPicker({ mapHint = true }: { mapHint?: boolean }) {
  const { t, i18n } = useTranslation();
  const { location, locate, gps } = useLocation();
  const lang = i18n.resolvedLanguage ?? 'en';

  return (
    <div className="location-picker">
      <button type="button" className="button-large" onClick={locate} disabled={gps === 'locating'}>
        <span aria-hidden="true">📍 </span>
        {gps === 'locating' ? t('location.locating') : t('location.useMine')}
      </button>
      {mapHint && <p className="hint">{t('location.orTapMap')}</p>}
      <div role="status" aria-live="polite">
        {gps !== 'idle' && gps !== 'locating' && (
          <p className="error-text">{t(`location.error.${gps}`)}</p>
        )}
        {location && (
          <p className="location-line">
            {location.source === 'gps'
              ? t('location.fromGps', {
                  time: formatTime(location.at, lang),
                  accuracy: location.accuracy ? formatDistance(location.accuracy, lang) : '?',
                })
              : location.source === 'home'
                ? t('location.fromHome')
                : t('location.fromMap')}
          </p>
        )}
      </div>
    </div>
  );
}
