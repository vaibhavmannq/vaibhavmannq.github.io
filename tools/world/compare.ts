/**
 * The look check (spec §15): each stop live, beside its render (run: npm run compare -- <baseUrl> <outDir> [stops]
 * [query]). Per stop a 1920x1080 frame and a 412x915 phone frame, stills off, on this machine's GPU (headed Chrome),
 * six seconds after the scene is ready. Writes <outDir>/index.html. `stops` is a comma list (default: all nine);
 * `query` is added to the URL (default: tier=high).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { STOP_IDS } from '../../src/journey/types.ts';

const [baseUrl, outDir, stopList, query = 'tier=high'] = process.argv.slice(2);
if (!baseUrl || !outDir) throw new Error('usage: compare <baseUrl> <outDir> [stops] [query]');
const stops = stopList ? stopList.split(',') : [...STOP_IDS];
mkdirSync(outDir, { recursive: true });
const stills = fileURLToPath(new URL('../../public/world/stills/', import.meta.url));
const SIZES = [
  { name: 'wide', width: 1920, height: 1080 },
  { name: 'phone', width: 412, height: 915 },
] as const;

const browser = await chromium.launch({ headless: false, channel: 'chrome', args: ['--ignore-gpu-blocklist'] });
for (const size of SIZES) {
  const context = await browser.newContext({
    viewport: { width: size.width, height: size.height },
    deviceScaleFactor: 1,
  });
  for (const stop of stops) {
    const page = await context.newPage();
    page.on('pageerror', (e) => console.log(`[${stop}] page error: ${String(e).slice(0, 300)}`));
    page.on('console', (m) => {
      if (m.type() === 'error') console.log(`[${stop}] ${m.text().slice(0, 300)}`);
    });
    await page.goto(`${baseUrl}/?stills=off&stop=${stop}&${query}`, { waitUntil: 'load' });
    await page.waitForFunction(() => document.documentElement.classList.contains('is-scene-ready'), undefined, {
      timeout: 120_000,
    });
    await page.waitForTimeout(6000);
    await page.screenshot({ path: join(outDir, `${stop}-${size.name}.png`) });
    await page.close();
    console.log(`${stop} ${size.name}`);
  }
  await context.close();
}
await browser.close();

const rel = relative(outDir, stills).split(sep).join('/');
const rows = stops
  .map(
    (stop) => `<figure><figcaption>${stop}</figcaption>
<div class="wide"><img src="${rel}/${stop}.webp" alt="render, ${stop}"><img src="${stop}-wide.png" alt="live, ${stop}"></div>
<div class="phone"><img src="${stop}-phone.png" alt="live on a phone, ${stop}"></div></figure>`,
  )
  .join('\n');
writeFileSync(
  join(outDir, 'index.html'),
  `<!doctype html><meta charset="utf-8"><title>Look check: render and live</title>
<style>body{margin:16px;background:#14101a;color:#eee;font:14px system-ui}figure{margin:0 0 28px}
.wide{display:grid;grid-template-columns:1fr 1fr;gap:8px}img{width:100%;display:block}.phone{width:206px;margin-top:8px}</style>
<h1>Render (left), live (right), live on a phone (below)</h1>
${rows}
`,
);
