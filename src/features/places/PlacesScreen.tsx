import { useTranslation } from 'react-i18next';
import { Page } from '../../components/Page';

export function PlacesScreen() {
  const { t } = useTranslation();
  return (
    <Page title={t('screens.places.title')}>
      <p>{t('screens.places.body')}</p>
    </Page>
  );
}
