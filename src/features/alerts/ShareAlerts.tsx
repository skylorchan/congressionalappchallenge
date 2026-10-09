import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AlertSnapshot } from '../../data/db';
import { encodeSnapshot, shareUrl } from './shareCodec';

/** "Share with a nearby phone": a QR code of the current alert summary. */
export function ShareAlerts({ snapshot }: { snapshot: AlertSnapshot }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState<{ svg: string; url: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    let live = true;
    encodeSnapshot(snapshot)
      .then(async (code) => {
        const url = shareUrl(code);
        const svg = await QRCode.toString(url, {
          type: 'svg',
          errorCorrectionLevel: 'L',
          margin: 2,
        });
        if (live) setQr({ svg, url });
      })
      .catch(() => live && setQr({ svg: '', url: '' }));
    return () => {
      live = false;
    };
  }, [open, snapshot]);

  return (
    <section className="card" aria-labelledby="share-alerts">
      <h2 id="share-alerts">{t('share.heading')}</h2>
      <p>{t('share.body')}</p>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)}>
          {t('share.show')}
        </button>
      ) : qr?.svg ? (
        <figure className="qr">
          {/* The SVG is generated locally by the qrcode library from our own data. */}
          <div
            className="qr-code"
            role="img"
            aria-label={t('share.qrLabel')}
            dangerouslySetInnerHTML={{ __html: qr.svg }}
          />
          <figcaption className="hint">
            {t('share.howToScan')} {t('share.orLink')}{' '}
            <a className="share-link" href={qr.url}>
              {qr.url}
            </a>
          </figcaption>
        </figure>
      ) : qr ? (
        <p className="error-text">{t('share.error')}</p>
      ) : (
        <p>{t('map.loading')}</p>
      )}
    </section>
  );
}
