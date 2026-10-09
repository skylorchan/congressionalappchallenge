import { useTranslation } from 'react-i18next';
import { compassPoint } from '../geo/distance';
import { formatDistance, walkMinutes } from '../lib/format';

/** "0.3 mi (450 m) northeast ↗ · at least 8 min on foot" */
export function Direction({ distance, bearing }: { distance: number; bearing: number }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  return (
    <span className="direction">
      <span className="direction-main">
        {t('direction.distanceToward', {
          distance: formatDistance(distance, lang),
          direction: t(`compass.${compassPoint(bearing)}`),
        })}
      </span>{' '}
      <span
        className="arrow"
        style={{ transform: `rotate(${Math.round(bearing)}deg)` }}
        aria-hidden="true"
      >
        ↑
      </span>
      <span className="direction-walk">
        {t('direction.walk', { minutes: walkMinutes(distance) })}
      </span>
    </span>
  );
}
