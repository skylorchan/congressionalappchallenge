import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

let isFirstPage = true;

/**
 * Wraps each screen. On navigation it moves keyboard/screen-reader focus to the new
 * heading and updates the tab title; otherwise screen-reader users would hear nothing
 * when they switch tabs in a single-page app.
 */
export function Page({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useTranslation();
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    document.title = `${title} · ${t('app.name')}`;
  }, [title, t]);

  useEffect(() => {
    if (isFirstPage) {
      isFirstPage = false; // don't steal focus on the initial page load
      return;
    }
    heading.current?.focus();
  }, []);

  return (
    <>
      <h1 ref={heading} tabIndex={-1}>
        {title}
      </h1>
      {children}
    </>
  );
}
