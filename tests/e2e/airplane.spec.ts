import { readFileSync } from 'node:fs';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

// A real NWS response (alerts for Hawaiʻi, downloaded 2026-10-09 by the fetch-data
// workflow). Served in place of api.weather.gov so the test doesn't depend on whatever
// the weather happens to be today.
const NWS_FEED = readFileSync(new URL('../../data/raw/nws-recent-hi.json', import.meta.url));

// Waikīkī Beach, inside the official Tsunami Evacuation Zone.
const WAIKIKI = { latitude: 21.276, longitude: -157.8268, accuracy: 15 };

test.use({ geolocation: WAIKIKI, permissions: ['geolocation'] });

/** Tap a tab in the bottom tab bar. */
const tab = (page: Page, name: string) =>
  page
    .getByRole('navigation', { name: /Main|メインメニュー/ })
    .getByRole('link', { name })
    .click();

/** First visit online: wait until the service worker has cached the whole app. */
async function installOnline(page: Page, context: BrowserContext) {
  await context.route('https://api.weather.gov/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/geo+json', body: NWS_FEED }),
  );
  await page.goto('./');
  await page.waitForFunction(async () => {
    const reg = await navigator.serviceWorker.ready;
    return reg.active !== null && navigator.serviceWorker.controller !== null;
  });
  // The "ready to work offline" message appears once precaching (incl. the 11 MB
  // basemap) has finished.
  await expect(page.getByText('Kōkua is ready to work offline.')).toBeVisible({
    timeout: 60_000,
  });
}

test('the whole app works in airplane mode after one online visit', async ({ page, context }) => {
  test.setTimeout(120_000);
  await installOnline(page, context);

  // Load alerts once while online so there is a saved copy.
  await tab(page, 'Alerts');
  await expect(page.getByText(/^Updated /)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Flood Advisory' }).first()).toBeVisible();

  // Fill in part of the family plan.
  await tab(page, 'My plan');
  await page.getByLabel('Household name').fill('Test ʻOhana');
  await page.getByRole('button', { name: 'Add a contact' }).click();
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Auntie Lei');
  await page.getByRole('textbox', { name: 'Phone' }).fill('808-555-0100');
  await page.getByLabel('Water: 1 gallon per person per day, for 14 days').check();

  // ✈️ Airplane mode on, and restart the app.
  await context.setOffline(true);
  await page.goto('./#/');
  await page.reload();
  await expect(page.getByText("You're offline. Saved information still works.")).toBeVisible();

  // 1. Am I in an evacuation zone? (GPS needs no internet.)
  await page.getByRole('button', { name: 'Use my location' }).click();
  await expect(
    page.getByRole('heading', { name: 'You are in the Tsunami Evacuation Zone' }),
  ).toBeVisible();
  await expect(page.getByText('Nearest way out for a Tsunami Warning:')).toBeVisible();
  await expect(page.getByText(/to the northeast/).first()).toBeVisible();
  await expect(page.locator('.map canvas')).toBeVisible();
  await expect(page.getByText(/mapped Apr 2025/)).toBeVisible();

  // The basemap's byte-range requests are answered from the offline cache.
  const range = await page.evaluate(async () => {
    const res = await fetch('map/oahu.pmtiles', { headers: { Range: 'bytes=0-126' } });
    return { status: res.status, length: (await res.arrayBuffer()).byteLength };
  });
  expect(range).toEqual({ status: 206, length: 127 });

  // 2. Nearest safe places.
  await tab(page, 'Safe places');
  await expect(page.getByRole('heading', { name: 'Nearest hurricane refuge areas' })).toBeVisible();
  const convention = page.locator('.place', { hasText: 'Hawaii Convention Center' });
  await expect(convention).toBeVisible();
  await expect(convention.getByText(/do not go here during a tsunami/)).toBeVisible();

  // 3. Alerts: the saved copy, clearly labelled, and no refresh while offline.
  await tab(page, 'Alerts');
  await expect(page.getByText(/^Updated /)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Flood Advisory' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Offline/ })).toBeDisabled();

  // 4. The family plan survived the restart.
  await tab(page, 'My plan');
  await expect(page.getByLabel('Household name')).toHaveValue('Test ʻOhana');
  await expect(page.getByRole('textbox', { name: 'Phone' })).toHaveValue('808-555-0100');
  await expect(page.getByText('1 of 22 checklist items ready')).toBeVisible();

  // 5. Switch language offline: Japanese UI, safety text stays English until reviewed.
  await page.getByLabel('Language').selectOption('ja');
  await tab(page, '避難区域');
  await expect(page.getByRole('heading', { name: '津波避難区域内にいます' })).toBeVisible();
  await expect(page.getByText(/leave this zone right away/)).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');

  // A language with no trustworthy translation yet stays English, and says so.
  await page.getByLabel('言語').selectOption('chk');
  await expect(page.getByText(/Chuukese translation of Kōkua isn't ready yet/)).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('kūpuna mode: one screen, giant buttons, works offline', async ({ page, context }) => {
  test.setTimeout(120_000);
  await installOnline(page, context);
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByLabel('Kūpuna mode (simple view)').check();
  await page.getByLabel('Extra large').check();

  await context.setOffline(true);
  await page.goto('./#/');
  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Am I safe here?' }).click();
  await expect(page.getByRole('heading', { name: 'You are in the tsunami zone' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Call 911' })).toHaveAttribute('href', 'tel:911');
  await expect(page.locator('html')).toHaveAttribute('data-text-size', 'xlarge');
});

test('shared alert link opens offline on another phone and is marked unverified', async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  await installOnline(page, context);
  await tab(page, 'Alerts');
  await page.getByRole('button', { name: 'Show share code' }).click();
  await expect(page.getByRole('img', { name: /QR code/ })).toBeVisible();
  const shareHref = await page.locator('.share-link').getAttribute('href');
  expect(shareHref).toMatch(/#\/shared\?d=/);

  // The other phone has Kōkua installed but no internet. (Same browser profile here,
  // so it's the same cached app, which is the realistic case.)
  await context.setOffline(true);
  await page.goto(shareHref!);
  await expect(page.getByText(/cannot check that this is real or current/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Flood Advisory' }).first()).toBeVisible();
});
