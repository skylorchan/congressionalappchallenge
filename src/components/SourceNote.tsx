import { useTranslation } from 'react-i18next';
import type { SourceInfo } from '../data/appData';
import { formatDate } from '../lib/format';

/** "Source: …, data updated Nov 20, 2025, downloaded Oct 9, 2026." */
export function SourceNote({ source }: { source: SourceInfo }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  return (
    <p className="source">
      {t('data.source')}{' '}
      <a href={source.url} target="_blank" rel="noreferrer">
        {source.publisher}
      </a>
      {source.sourceDate && (
        <> · {t('data.mapped', { date: formatDate(source.sourceDate, lang) })}</>
      )}
      {source.layerUpdated && (
        <> · {t('data.updated', { date: formatDate(source.layerUpdated, lang) })}</>
      )}
      {source.retrieved && (
        <> · {t('data.downloaded', { date: formatDate(source.retrieved, lang) })}</>
      )}
    </p>
  );
}
