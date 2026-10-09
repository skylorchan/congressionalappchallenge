import { useTranslation } from 'react-i18next';
import { useOnlineStatus } from '../app/useOnlineStatus';

export function OfflineBanner() {
  const online = useOnlineStatus();
  const { t } = useTranslation();
  // role="status" makes screen readers announce the change without stealing focus.
  return (
    <div role="status" className="banner-slot">
      {!online && <p className="banner banner-offline">{t('status.offline')}</p>}
    </div>
  );
}
