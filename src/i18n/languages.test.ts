import { describe, expect, it } from 'vitest';
import { detectLanguage, isSupportedLanguage } from './languages';

describe('detectLanguage', () => {
  it('uses the saved choice first', () => {
    expect(detectLanguage('ja', ['en-US'])).toBe('ja');
  });

  it('ignores a saved language we no longer support', () => {
    expect(detectLanguage('xx', ['ja-JP'])).toBe('ja');
  });

  it('matches a browser region tag to its base language', () => {
    expect(detectLanguage(null, ['ja-JP'])).toBe('ja');
    expect(detectLanguage(null, ['JA'])).toBe('ja');
  });

  it('takes the first supported browser language in order', () => {
    expect(detectLanguage(null, ['fr-FR', 'ja', 'en'])).toBe('ja');
  });

  it('falls back to English', () => {
    expect(detectLanguage(null, [])).toBe('en');
    expect(detectLanguage(null, ['fr', 'de'])).toBe('en');
  });
});

describe('isSupportedLanguage', () => {
  it('accepts known codes only', () => {
    expect(isSupportedLanguage('en')).toBe(true);
    expect(isSupportedLanguage('ja')).toBe(true);
    expect(isSupportedLanguage('ja-JP')).toBe(false);
  });
});
