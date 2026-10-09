import { useTranslation } from 'react-i18next';
import { Page } from '../../components/Page';

export function AlertsScreen() {
  const { t } = useTranslation();
  return (
    <Page title={t('screens.alerts.title')}>
      <p>{t('screens.alerts.body')}</p>
    </Page>
  );
}
