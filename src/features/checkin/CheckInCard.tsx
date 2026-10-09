import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from '../../app/location';
import { useOnlineStatus } from '../../app/useOnlineStatus';
import { formatTime } from '../../lib/format';
import type { FamilyPlan } from '../plan/planModel';
import { loadPlan } from '../plan/usePlan';
import { enqueue, markSent, pending, smsLink, type CheckIn } from './checkinQueue';

const CHANGED = 'kokua:checkin-changed';
const announce = () => window.dispatchEvent(new Event(CHANGED));

/** The unsent check-in, kept in sync across the card and the global banner. */
export function usePendingCheckIn() {
  const [item, setItem] = useState<CheckIn | null>(null);
  const reload = useCallback(() => {
    pending()
      .then(setItem)
      .catch(() => setItem(null));
  }, []);
  useEffect(() => {
    reload();
    window.addEventListener(CHANGED, reload);
    return () => window.removeEventListener(CHANGED, reload);
  }, [reload]);
  return item;
}

function SendActions({ item, phones }: { item: CheckIn; phones: string[] }) {
  const { t } = useTranslation();
  const online = useOnlineStatus();
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator;
  return (
    <div className="button-row">
      <a className="button-link button-primary-link" href={smsLink(phones, item.message)}>
        {t('checkin.sendText')}
      </a>
      {canShare && online && (
        <button
          type="button"
          className="button-secondary"
          onClick={() => void navigator.share({ text: item.message }).catch(() => {})}
        >
          {t('checkin.share')}
        </button>
      )}
      <button
        type="button"
        className="button-secondary"
        onClick={() => void markSent(item.id).then(announce)}
      >
        {t('checkin.markSent')}
      </button>
    </div>
  );
}

/** "Tell my family I'm safe" on the Plan screen. */
export function CheckInCard({ plan }: { plan: FamilyPlan }) {
  const { t, i18n } = useTranslation();
  const { location } = useLocation();
  const item = usePendingCheckIn();
  const [note, setNote] = useState('');
  const [withLocation, setWithLocation] = useState(true);
  const phones = plan.contacts.map((c) => c.phone).filter(Boolean);

  const queue = () => {
    const now = Date.now();
    const where =
      location && withLocation
        ? ` ${t('checkin.near', {
            lat: location.coord[1].toFixed(4),
            lng: location.coord[0].toFixed(4),
          })}`
        : '';
    const message = [
      t('checkin.message', { time: formatTime(now, i18n.resolvedLanguage ?? 'en') }) + where,
      note.trim(),
      plan.household && `— ${plan.household}`,
    ]
      .filter(Boolean)
      .join('\n');
    void enqueue(message, now).then(() => {
      setNote('');
      announce();
    });
  };

  return (
    <section className="card card-checkin" aria-labelledby="checkin">
      <h2 id="checkin">{t('checkin.heading')}</h2>
      <p>{t('checkin.intro')}</p>
      {phones.length === 0 && <p className="hint">{t('checkin.noContacts')}</p>}
      <label className="field">
        <span>{t('checkin.noteLabel')}</span>
        <input type="text" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {location && (
        <label className="check">
          <input
            type="checkbox"
            checked={withLocation}
            onChange={(e) => setWithLocation(e.target.checked)}
          />
          <span>{t('checkin.includeLocation')}</span>
        </label>
      )}
      <button type="button" className="button-large" onClick={queue}>
        {t('checkin.queue')}
      </button>
      {item && (
        <div className="checkin-pending" role="status">
          <p>
            <strong>{t('checkin.pending')}</strong>
          </p>
          <pre className="checkin-message">{item.message}</pre>
          <SendActions item={item} phones={phones} />
        </div>
      )}
    </section>
  );
}

/** App-wide reminder: shows up when you're back online with an unsent check-in. */
export function CheckInBanner() {
  const { t } = useTranslation();
  const online = useOnlineStatus();
  const item = usePendingCheckIn();
  const [phones, setPhones] = useState<string[]>([]);
  useEffect(() => {
    if (!item) return;
    let live = true;
    loadPlan()
      .then((p) => live && setPhones(p.contacts.map((c) => c.phone).filter(Boolean)))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [item]);
  if (!item || !online) return null;
  return (
    <div className="banner banner-checkin" role="status">
      <p>{t('checkin.bannerBackOnline')}</p>
      <SendActions item={item} phones={phones} />
    </div>
  );
}
