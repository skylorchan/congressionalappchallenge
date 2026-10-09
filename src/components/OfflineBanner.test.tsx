import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../i18n/locales/en.json';
import { setupTestI18n } from '../test/i18n';
import { OfflineBanner } from './OfflineBanner';

function goOffline(offline: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(!offline);
  window.dispatchEvent(new Event(offline ? 'offline' : 'online'));
}

beforeEach(() => setupTestI18n('en'));
afterEach(() => vi.restoreAllMocks());

describe('OfflineBanner', () => {
  it('shows nothing while online', () => {
    render(<OfflineBanner />);
    expect(screen.queryByText(en.status.offline)).not.toBeInTheDocument();
  });

  it('appears when the connection drops and disappears when it returns', () => {
    render(<OfflineBanner />);
    act(() => goOffline(true));
    expect(screen.getByText(en.status.offline)).toBeInTheDocument();
    act(() => goOffline(false));
    expect(screen.queryByText(en.status.offline)).not.toBeInTheDocument();
  });

  it('lives in a status region so screen readers announce it', () => {
    render(<OfflineBanner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
