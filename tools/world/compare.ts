/**
 * The look check (spec §15): each stop live, beside its render (run: npm run compare -- <baseUrl> <outDir> [stops]
 * [query]). Per stop a 1920x1080 frame and a 412x915 phone frame, stills off, on this machine's GPU (headed Chrome),
 * six seconds after the scene is ready. Writes <outDir>/index.html. `stops` is a comma list (default: all nine);
 * `query` is added to the URL (default: tier=high). When .superpowers/refs/compare.json ({ "<stop>": ["<folder>/<file>"] })
 * names the owner's photos for a stop, they sit in a third column at the same height; a missing file reads "no reference".
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
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
    // The dev server reloads the first page after a source change, and that reload can land on the first stop:
    // shoot only once the page really rests at the stop asked for.
    for (let attempt = 0; attempt < 3; attempt++) {
      await page.waitForFunction(() => document.documentElement.classList.contains('is-scene-ready'), undefined, {
        timeout: 120_000,
      });
      await page.waitForTimeout(6000);
      const at = await page.evaluate(() =>
        [...document.querySelectorAll('#rail a')].findIndex((a) => a.hasAttribute('aria-current')),
      );
      if (at === STOP_IDS.indexOf(stop as (typeof STOP_IDS)[number])) break;
      await page.goto('about:blank');
      await page.goto(`${baseUrl}/?stills=off&stop=${stop}&${query}`, { waitUntil: 'load' });
    }
    await page.screenshot({ path: join(outDir, `${stop}-${size.name}.png`) });
    await page.close();
    console.log(`${stop} ${size.name}`);
  }
  await context.close();
}
await browser.close();

const rel = relative(outDir, stills).split(sep).join('/');
const refsDir = fileURLToPath(new URL('../../.superpowers/refs/', import.meta.url));
const refsFile = join(refsDir, 'compare.json');
const refs: Record<string, string[]> = existsSync(refsFile) ? JSON.parse(readFileSync(refsFile, 'utf8')) : {};
const refColumn = (stop: string) =>
  (refs[stop] ?? [])
    .map((name) =>
      existsSync(join(refsDir, name))
        ? `<figure class="ref"><img src="${encodeURI(relative(resolve(outDir), join(refsDir, name)).split(sep).join('/'))}" alt="reference, ${name}"><figcaption>${name}</figcaption></figure>`
        : `<p class="ref">no reference (${name})</p>`,
    )
    .join('');
const rows = stops
  .map(
    (stop) => `<figure><figcaption>${stop}</figcaption>
<div class="wide"><img src="${rel}/${stop}.webp" alt="render, ${stop}"><img src="${stop}-wide.png" alt="live, ${stop}"></div>
${refs[stop] ? `<div class="refs">${refColumn(stop)}</div>` : ''}
<div class="phone"><img src="${stop}-phone.png" alt="live on a phone, ${stop}"></div></figure>`,
  )
  .join('\n');
writeFileSync(
  join(outDir, 'index.html'),
  `<!doctype html><meta charset="utf-8"><title>Look check: render and live</title>
<style>body{margin:16px;background:#14101a;color:#eee;font:14px system-ui}figure{margin:0 0 28px}
.wide{display:grid;grid-template-columns:1fr 1fr;gap:8px}img{width:100%;display:block}.phone{width:206px;margin-top:8px}
.refs{display:flex;gap:8px;margin-top:8px;height:300px}.refs .ref{margin:0;height:100%;display:flex;flex-direction:column}
.refs img{width:auto;height:280px;object-fit:contain}.refs figcaption{font-size:11px;opacity:.7}</style>
<h1>Render (left), live (right), live on a phone (below)</h1>
${rows}
`,
);
