import QRCode from 'qrcode';
import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useLocation } from '../../app/location';
import { Page } from '../../components/Page';
import { useAppData } from '../../data/appData';
import { CheckInCard } from '../checkin/CheckInCard';
import {
  CHECKLIST_GROUPS,
  newId,
  planToText,
  progress,
  type Contact,
  type FamilyPlan,
} from './planModel';
import { usePlan } from './usePlan';

function Field({
  label,
  value,
  onChange,
  multiline = false,
  type = 'text',
  autoComplete,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  type?: string;
  autoComplete?: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {hint && (
        <p className="hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {multiline ? (
        <textarea
          id={id}
          value={value}
          rows={3}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          autoComplete={autoComplete}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

function usePlanText(plan: FamilyPlan | null) {
  const { t } = useTranslation();
  return plan
    ? planToText(plan, {
        title: t('plan.printTitle'),
        home: t('plan.homeAddress'),
        members: t('plan.members'),
        meetingNear: t('plan.meetingNear'),
        meetingAway: t('plan.meetingAway'),
        outOfArea: t('plan.outOfArea'),
        contacts: t('plan.contactsHeading'),
      })
    : '';
}

function PlanQR({ text }: { text: string }) {
  const { t } = useTranslation();
  const [svg, setSvg] = useState('');
  useEffect(() => {
    let live = true;
    QRCode.toString(text, { type: 'svg', errorCorrectionLevel: 'M', margin: 2 })
      .then((s) => live && setSvg(s))
      .catch(() => live && setSvg(''));
    return () => {
      live = false;
    };
  }, [text]);
  if (!svg) return null;
  return (
    <div
      className="qr-code"
      role="img"
      aria-label={t('plan.qrLabel')}
      // Generated locally by the qrcode library from the user's own plan text.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export function PlanScreen() {
  const { t } = useTranslation();
  const { plan, update, flush } = usePlan();
  const { location, setLocation } = useLocation();
  const { data } = useAppData();
  const [showQR, setShowQR] = useState(false);
  const text = usePlanText(plan);

  if (!plan) return <Page title={t('screens.plan.title')}>{null}</Page>;

  const { done, total } = progress(plan);
  const homeZone = plan.home && data ? data.zones.lookup(plan.home).status : null;
  const setContact = (id: string, change: Partial<Contact>) =>
    update((p) => ({ contacts: p.contacts.map((c) => (c.id === id ? { ...c, ...change } : c)) }));

  return (
    <Page title={t('screens.plan.title')}>
      <p className="screen-only">{t('plan.intro')}</p>
      <p className="screen-only progress-line">
        <strong>{t('plan.progress', { done, total })}</strong>
        <progress max={total} value={done} aria-hidden="true" />
      </p>

      <div className="screen-only">
        <CheckInCard plan={plan} />

        <section className="card" aria-labelledby="household">
          <h2 id="household">{t('plan.householdHeading')}</h2>
          <Field
            label={t('plan.household')}
            value={plan.household}
            onChange={(household) => update({ household })}
            autoComplete="family-name"
          />
          <Field
            label={t('plan.members')}
            hint={t('plan.membersHint')}
            value={plan.members}
            onChange={(members) => update({ members })}
            multiline
          />
          <Field
            label={t('plan.homeAddress')}
            value={plan.homeAddress}
            onChange={(homeAddress) => update({ homeAddress })}
            autoComplete="street-address"
          />
          <div className="field">
            <p className="label-like">{t('plan.homeLocation')}</p>
            {plan.home ? (
              <p>
                {t('plan.homeSaved')} {homeZone && <strong>{t(`zone.status.${homeZone}`)}</strong>}
              </p>
            ) : (
              <p className="hint">{t('plan.homeNotSet')}</p>
            )}
            <div className="button-row">
              <button
                type="button"
                className="button-secondary"
                disabled={!location}
                onClick={() => location && update({ home: location.coord })}
              >
                {t('plan.useCheckedSpot')}
              </button>
              {plan.home && (
                <Link
                  className="button-link"
                  to="/"
                  onClick={() => plan.home && setLocation(plan.home, 'home')}
                >
                  {t('plan.checkHome')}
                </Link>
              )}
            </div>
            {!location && <p className="hint">{t('plan.homeHowTo')}</p>}
          </div>
        </section>

        <section className="card" aria-labelledby="meeting">
          <h2 id="meeting">{t('plan.meetingHeading')}</h2>
          <Field
            label={t('plan.meetingNear')}
            hint={t('plan.meetingNearHint')}
            value={plan.meetingNear}
            onChange={(meetingNear) => update({ meetingNear })}
          />
          <Field
            label={t('plan.meetingAway')}
            hint={t('plan.meetingAwayHint')}
            value={plan.meetingAway}
            onChange={(meetingAway) => update({ meetingAway })}
          />
        </section>

        <section className="card" aria-labelledby="contacts">
          <h2 id="contacts">{t('plan.contactsHeading')}</h2>
          <Field
            label={t('plan.outOfArea')}
            hint={t('plan.outOfAreaHint')}
            value={plan.outOfAreaContact}
            onChange={(outOfAreaContact) => update({ outOfAreaContact })}
          />
          <ul className="contact-list">
            {plan.contacts.map((c, i) => (
              <li key={c.id} className="contact">
                <fieldset>
                  <legend>{t('plan.contactN', { n: i + 1 })}</legend>
                  <Field
                    label={t('plan.contactName')}
                    value={c.name}
                    onChange={(name) => setContact(c.id, { name })}
                    autoComplete="off"
                  />
                  <Field
                    label={t('plan.contactRelation')}
                    value={c.relation}
                    onChange={(relation) => setContact(c.id, { relation })}
                  />
                  <Field
                    label={t('plan.contactPhone')}
                    type="tel"
                    value={c.phone}
                    onChange={(phone) => setContact(c.id, { phone })}
                    autoComplete="off"
                  />
                  <div className="button-row">
                    {c.phone && (
                      <a className="button-link" href={`tel:${c.phone.replace(/[^\d+]/g, '')}`}>
                        {t('plan.call')}
                      </a>
                    )}
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() =>
                        update((p) => ({ contacts: p.contacts.filter((x) => x.id !== c.id) }))
                      }
                    >
                      {t('plan.removeContact')}
                    </button>
                  </div>
                </fieldset>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() =>
              update((p) => ({
                contacts: [...p.contacts, { id: newId(), name: '', relation: '', phone: '' }],
              }))
            }
          >
            {t('plan.addContact')}
          </button>
        </section>

        <section className="card" aria-labelledby="checklist">
          <h2 id="checklist">{t('plan.checklistHeading')}</h2>
          <p className="hint">{t('plan.checklistIntro')}</p>
          {CHECKLIST_GROUPS.map((g) => (
            <fieldset key={g.id} className="checklist-group">
              <legend>{t(`plan.groups.${g.id}`)}</legend>
              {g.items.map((id) => (
                <label key={id} className="check">
                  <input
                    type="checkbox"
                    checked={!!plan.checklist[id]}
                    onChange={(e) =>
                      update((p) => ({ checklist: { ...p.checklist, [id]: e.target.checked } }))
                    }
                  />
                  <span>{t(`plan.items.${id}`)}</span>
                </label>
              ))}
            </fieldset>
          ))}
        </section>

        <section className="card" aria-labelledby="notes">
          <h2 id="notes">{t('plan.notesHeading')}</h2>
          <Field
            label={t('plan.notes')}
            hint={t('plan.notesHint')}
            value={plan.notes}
            onChange={(notes) => update({ notes })}
            multiline
          />
        </section>

        <section className="card" aria-labelledby="export">
          <h2 id="export">{t('plan.exportHeading')}</h2>
          <p>{t('plan.exportIntro')}</p>
          <div className="button-row">
            <button
              type="button"
              onClick={() => {
                flush();
                window.print();
              }}
            >
              {t('plan.print')}
            </button>
            <button type="button" className="button-secondary" onClick={() => setShowQR((v) => !v)}>
              {showQR ? t('plan.hideQR') : t('plan.showQR')}
            </button>
          </div>
          {showQR && (
            <figure className="qr">
              <PlanQR text={text} />
              <figcaption className="hint">{t('plan.qrHelp')}</figcaption>
            </figure>
          )}
          <p className="hint">{t('plan.privacy')}</p>
        </section>
      </div>

      <PrintablePlan plan={plan} text={text} />
    </Page>
  );
}

/** The one-page printout. Hidden on screen; the only thing shown when printing. */
function PrintablePlan({ plan, text }: { plan: FamilyPlan; text: string }) {
  const { t } = useTranslation();
  const row = (label: string, value: string) =>
    value.trim() ? (
      <tr>
        <th scope="row">{label}</th>
        <td>{value}</td>
      </tr>
    ) : null;
  return (
    <div className="print-only printable-plan">
      <h2>
        {t('plan.printTitle')}
        {plan.household && `: ${plan.household}`}
      </h2>
      <table>
        <tbody>
          {row(t('plan.homeAddress'), plan.homeAddress)}
          {row(t('plan.members'), plan.members)}
          {row(t('plan.meetingNear'), plan.meetingNear)}
          {row(t('plan.meetingAway'), plan.meetingAway)}
          {row(t('plan.outOfArea'), plan.outOfAreaContact)}
          {row(t('plan.notes'), plan.notes)}
        </tbody>
      </table>
      {plan.contacts.length > 0 && (
        <>
          <h3>{t('plan.contactsHeading')}</h3>
          <table>
            <tbody>
              {plan.contacts.map((c) => (
                <tr key={c.id}>
                  <th scope="row">{c.name}</th>
                  <td>{c.relation}</td>
                  <td>{c.phone}</td>
                </tr>
              ))}
              <tr>
                <th scope="row">{t('plan.emergency')}</th>
                <td />
                <td>911</td>
              </tr>
            </tbody>
          </table>
        </>
      )}
      <div className="print-qr">
        <PlanQR text={text} />
        <p>{t('plan.qrHelp')}</p>
      </div>
      <p className="print-footer">{t('plan.printFooter')}</p>
    </div>
  );
}
