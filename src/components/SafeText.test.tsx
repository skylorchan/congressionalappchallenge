import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import en from '../i18n/locales/en.json';
import ja from '../i18n/locales/ja.json';
import * as translationStatus from '../i18n/translationStatus';
import { setupTestI18n } from '../test/i18n';
import { SafeText } from './SafeText';

afterEach(() => vi.restoreAllMocks());

describe('SafeText', () => {
  it('shows English text in English with no warning note', async () => {
    await setupTestI18n('en');
    render(<SafeText k="safety.naturalWarning" />);
    expect(screen.getByText(en.safety.naturalWarning)).toBeInTheDocument();
    expect(screen.queryByText(en.i18n.unreviewed)).not.toBeInTheDocument();
  });

  it('falls back to English plus a note when the translation is unreviewed', async () => {
    await setupTestI18n('ja');
    vi.spyOn(translationStatus, 'isReviewed').mockReturnValue(false);
    render(<SafeText k="safety.naturalWarning" />);

    const english = screen.getByText(en.safety.naturalWarning);
    expect(english).toHaveAttribute('lang', 'en'); // screen readers switch voice
    expect(screen.queryByText(ja.safety.naturalWarning)).not.toBeInTheDocument();
    // The explanation itself is shown in the user's language.
    expect(screen.getByText(ja.i18n.unreviewed)).toBeInTheDocument();
  });

  it('shows the translation once a human has reviewed it', async () => {
    await setupTestI18n('ja');
    vi.spyOn(translationStatus, 'isReviewed').mockReturnValue(true);
    render(<SafeText k="safety.naturalWarning" />);
    expect(screen.getByText(ja.safety.naturalWarning)).toBeInTheDocument();
    expect(screen.queryByText(en.safety.naturalWarning)).not.toBeInTheDocument();
  });
});

describe('isReviewed', () => {
  it('always treats English as reviewed', () => {
    expect(translationStatus.isReviewed('en', 'safety.naturalWarning')).toBe(true);
  });

  it('treats unknown languages and keys as unreviewed', () => {
    expect(translationStatus.isReviewed('xx', 'safety.naturalWarning')).toBe(false);
    expect(translationStatus.isReviewed('ja', 'safety.doesNotExist')).toBe(false);
  });
});
