import { useTranslation } from 'react-i18next';
import { Page } from '../../components/Page';

export function PlanScreen() {
  const { t } = useTranslation();
  return (
    <Page title={t('screens.plan.title')}>
      <p>{t('screens.plan.body')}</p>
    </Page>
  );
}
