import { useRegisterSW } from 'virtual:pwa-register/react';
import { useTranslation } from 'react-i18next';

/**
 * Registers the service worker and shows two messages:
 *  - "ready to work offline" once the app is fully cached the first time;
 *  - "new version available" when an update is waiting. We never auto-reload, so an
 *    update can't interrupt someone in the middle of using the app.
 */
export function UpdatePrompt() {
  const { t } = useTranslation();
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!offlineReady && !needRefresh) return null;

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  return (
    <div role="status" className="banner banner-info">
      <p>{needRefresh ? t('status.updateAvailable') : t('status.offlineReady')}</p>
      <div className="banner-actions">
        {needRefresh && (
          <button type="button" onClick={() => void updateServiceWorker(true)}>
            {t('status.reload')}
          </button>
        )}
        <button type="button" className="button-secondary" onClick={close}>
          {t('status.dismiss')}
        </button>
      </div>
    </div>
  );
}
