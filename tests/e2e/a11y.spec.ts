import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Real NWS sample (see airplane.spec.ts) so the Alerts screen has content to check.
const NWS_FEED = readFileSync(new URL('../../data/raw/nws-recent-hi.json', import.meta.url));

test.use({
  geolocation: { latitude: 21.276, longitude: -157.8268, accuracy: 15 },
  permissions: ['geolocation'],
});

const SCREENS = ['#/zone', '#/places', '#/alerts', '#/plan', '#/settings'];

async function scan(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    // MapLibre's WebGL canvas is a visual aid; everything on it is also given as text.
    .exclude('.maplibregl-canvas')
    .analyze();
  const summary = results.violations.map(
    (v) => `${label}: ${v.id} (${v.impact}) ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  );
  expect(summary).toEqual([]);
}

for (const mode of ['normal', 'high'] as const) {
  test(`every screen passes WCAG 2.1 AA checks (${mode} contrast)`, async ({ page, context }) => {
    test.setTimeout(90_000);
    await context.route('https://api.weather.gov/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/geo+json', body: NWS_FEED }),
    );
    await page.goto('./');
    if (mode === 'high')
      await page.evaluate(() =>
        localStorage.setItem(
          'kokua.settings',
          JSON.stringify({ textSize: 'normal', highContrast: true, kupuna: false }),
        ),
      );
    await page.reload();
    await page.getByRole('button', { name: 'Use my location' }).click();
    await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible();

    for (const hash of SCREENS) {
      await page.goto(`./${hash}`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      if (hash === '#/alerts') await expect(page.getByText(/^Updated /)).toBeVisible();
      if (hash === '#/plan') await page.getByRole('button', { name: 'Add a contact' }).click();
      await scan(page, `${hash} ${mode}`);
    }
  });
}

test('kūpuna mode and Japanese UI pass WCAG 2.1 AA checks', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => {
    localStorage.setItem(
      'kokua.settings',
      JSON.stringify({ textSize: 'xlarge', highContrast: false, kupuna: true }),
    );
    localStorage.setItem('kokua.language', 'ja');
  });
  await page.reload();
  await page.getByRole('button', { name: 'ここは安全？' }).click();
  await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible();
  await scan(page, 'kupuna ja');
});
