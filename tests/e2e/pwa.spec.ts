import { expect, test } from '@playwright/test';

// Lighthouse 12 no longer scores "PWA", so we check Chrome's install criteria directly.
test('web app manifest meets install requirements', async ({ page, request }) => {
  await page.goto('./');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();

  const res = await request.get(new URL(href!, page.url()).toString());
  expect(res.ok()).toBe(true);
  const manifest = await res.json();

  expect(manifest.name).toBeTruthy();
  expect(manifest.short_name).toBeTruthy();
  expect(manifest.start_url).toBe('/congressionalappchallenge/');
  expect(manifest.scope).toBe('/congressionalappchallenge/');
  expect(['standalone', 'fullscreen', 'minimal-ui']).toContain(manifest.display);

  const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
  expect(sizes).toContain('192x192');
  expect(sizes).toContain('512x512');
  for (const icon of manifest.icons) {
    const iconRes = await request.get(new URL(icon.src, res.url()).toString());
    expect(iconRes.ok(), icon.src).toBe(true);
  }
});

test('skip link moves focus to the main content', async ({ page }) => {
  await page.goto('./');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
});
