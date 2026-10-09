// Renders public/icons/favicon.svg to the PNG sizes the web app manifest needs, using
// the Playwright Chromium we already have for e2e tests (no extra image library).
// Run: node scripts/generate-icons.mjs
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const svg = readFileSync(new URL('../public/icons/favicon.svg', import.meta.url), 'utf8');
const out = (name) => new URL(`../public/icons/${name}`, import.meta.url).pathname;

const browser = await chromium.launch();
const page = await browser.newPage();

async function render(size, file, { maskable = false } = {}) {
  await page.setViewportSize({ width: size, height: size });
  // Maskable icons get cropped to a circle by Android, so the art must sit inside the
  // central 80% "safe zone" on a full-bleed background.
  const inner = maskable
    ? `<div style="width:100%;height:100%;background:#0b4f6c;display:grid;place-items:center">
         <div style="width:72%;height:72%">${svg}</div></div>`
    : svg;
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{width:100%;height:100%;display:block}</style>${inner}`,
  );
  await page.screenshot({ path: out(file), omitBackground: !maskable });
}

await render(192, 'icon-192.png');
await render(512, 'icon-512.png');
await render(512, 'icon-maskable-512.png', { maskable: true });
await browser.close();
console.log('icons written');
