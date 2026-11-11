/**
 * Shoot the journey from the air for the look check (run: npm run aerials -- <baseUrl> <outDir> [<otherDir>]).
 * 24 frames, evenly spread over the whole night, 1280x720, high, stills off, on this machine's GPU (headed Chrome).
 * It uses only the `?p=` start parameter, so the same tool shoots older builds too. With <otherDir> (an earlier set),
 * it also writes <outDir>/index.html showing the two sets side by side.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { chromium } from '@playwright/test';

const [baseUrl, outDir, otherDir] = process.argv.slice(2);
if (!baseUrl || !outDir) throw new Error('usage: aerials <baseUrl> <outDir> [<otherDir>]');
mkdirSync(outDir, { recursive: true });
const FRAMES = 24;
const names: string[] = [];

const browser = await chromium.launch({ headless: false, channel: 'chrome', args: ['--ignore-gpu-blocklist'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
for (let k = 0; k < FRAMES; k++) {
  const p = (k + 0.5) / FRAMES;
  const name = `p-${p.toFixed(3)}.png`;
  names.push(name);
  const page = await context.newPage();
  await page.goto(`${baseUrl}/?stills=off&tier=high&p=${p.toFixed(4)}`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.documentElement.classList.contains('is-scene-ready'), undefined, {
    timeout: 120_000,
  });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: join(outDir, name) });
  await page.close();
  console.log(name);
}
await browser.close();

if (otherDir) {
  const rel = relative(outDir, otherDir).replaceAll(sep, '/');
  const rows = names
    .map((n) => {
      const before = existsSync(join(otherDir, n)) ? `<img src="${rel}/${n}" alt="before, ${n}">` : '<p>no frame</p>';
      return `<figure><figcaption>${n.slice(0, -4)}</figcaption><div>${before}<img src="${n}" alt="after, ${n}"></div></figure>`;
    })
    .join('\n');
  writeFileSync(
    join(outDir, 'index.html'),
    `<!doctype html><meta charset="utf-8"><title>Aerials: before and after</title>
<style>body{margin:16px;background:#14101a;color:#eee;font:14px system-ui}figure{margin:0 0 20px}
div{display:grid;grid-template-columns:1fr 1fr;gap:8px}img{width:100%;display:block}</style>
<h1>Before (left) and after (right)</h1>
${rows}
`,
  );
}
