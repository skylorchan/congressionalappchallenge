import { expect, test, type Page } from '@playwright/test';

/** Wait until the service worker has installed, cached the app, and controls the page. */
async function waitForServiceWorker(page: Page) {
  await page.waitForFunction(async () => {
    const reg = await navigator.serviceWorker.ready;
    return reg.active !== null && navigator.serviceWorker.controller !== null;
  });
}

test.describe('offline (airplane mode) v0', () => {
  test('app shell loads and switches language with no network after first visit', async ({
    page,
    context,
  }) => {
    // First visit online: this is when everything gets cached.
    await page.goto('./');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Am I in an evacuation zone?');
    await waitForServiceWorker(page);

    // Airplane mode on.
    await context.setOffline(true);
    await page.reload();

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Am I in an evacuation zone?');
    await expect(page.getByText("You're offline. Saved information still works.")).toBeVisible();

    // Japanese was never loaded online; it must come from the service worker's cache.
    await page.getByLabel('Language').selectOption('ja');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('避難区域内にいますか？');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja');

    // Safety text stays English (unreviewed translation) with a Japanese explanation.
    await expect(page.getByText(/move inland or to high ground right away/)).toBeVisible();
    await expect(page.getByText(/翻訳がまだ確認されていない/)).toBeVisible();

    // Navigation between screens works offline too.
    await page.getByRole('link', { name: '避難場所' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('最寄りの避難場所');
  });

  test('remembers the chosen language across an offline restart', async ({ page, context }) => {
    await page.goto('./');
    await waitForServiceWorker(page);
    await page.getByLabel('Language').selectOption('ja');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('避難区域内にいますか？');

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('避難区域内にいますか？');
  });
});
