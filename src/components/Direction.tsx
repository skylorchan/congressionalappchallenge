import { useTranslation } from 'react-i18next';
import { compassPoint } from '../geo/distance';
import type { Route, RouteStep } from '../geo/route';
import { formatDistance, walkMinutes } from '../lib/format';

type Props = {
  distance: number;
  bearing: number;
  /** Walking route along roads and paths, if one was found. */
  route?: Route | null;
  /** Last line of the step list, e.g. "Arrive on safe ground". */
  arrival?: string;
};

/**
 * Walking route: "0.2 mi (340 m) walk · head northeast ↗ · about 6 min on foot", with the
 * turn-by-turn steps folded away underneath. Without a route: the straight-line distance
 * and compass direction, labelled as such.
 */
export function Direction({ distance, bearing, route, arrival }: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  const arrow = (
    <span
      className="arrow"
      style={{ transform: `rotate(${Math.round(bearing)}deg)` }}
      aria-hidden="true"
    >
      ↑
    </span>
  );
  if (!route)
    return (
      <span className="direction">
        <span className="direction-main">
          {t('direction.distanceToward', {
            distance: formatDistance(distance, lang),
            direction: t(`compass.${compassPoint(bearing)}`),
          })}
        </span>{' '}
        {arrow}
        <span className="direction-walk">
          {t('direction.walk', { minutes: walkMinutes(distance) })} · {t('direction.straight')}
        </span>
      </span>
    );
  return (
    <span className="direction">
      <span className="direction-main">
        {t('direction.walkRoute', { distance: formatDistance(distance, lang) })}
      </span>
      <span className="direction-walk">
        {t('direction.headToward', { direction: t(`compass.${compassPoint(bearing)}`) })} {arrow} ·{' '}
        {t('direction.walkAbout', { minutes: walkMinutes(distance) })}
      </span>
      <RouteSteps steps={route.steps} arrival={arrival} />
    </span>
  );
}

function RouteSteps({ steps, arrival }: { steps: RouteStep[]; arrival?: string }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  return (
    <details className="route-steps">
      <summary>{t('route.stepsHeading')}</summary>
      <ol>
        {steps.map((s, i) => {
          const street = s.street ?? t('route.unnamed');
          const distance = formatDistance(s.distance, lang);
          return (
            <li key={i}>
              {s.kind === 'depart'
                ? t('route.depart', {
                    direction: t(`compass.${compassPoint(s.bearing)}`),
                    street,
                    distance,
                  })
                : t(`route.${s.kind}`, { street, distance })}
            </li>
          );
        })}
        {arrival && <li>{arrival}</li>}
      </ol>
    </details>
  );
}
