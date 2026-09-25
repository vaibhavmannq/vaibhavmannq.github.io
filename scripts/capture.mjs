// Renders the stills fallback and the project cover from the real scene (spec 2026-09-25 §4.10).
// Usage: npm run build && npm run capture
// Needs a real GPU, so it opens a visible browser: run it on a real machine, not in CI.
import { spawn, spawnSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { chromium } from '@playwright/test';

// Where each page is fully shown (overlay/sections.ts SHOWN_OFFSET), so each still has its own chapter's moon.
const PAGES = [
  ['intro', 0],
  ['about', 0.335],
  ['projects', 0.585],
  ['contact', 0.835],
];
const SHAPES = [
  ['landscape', { width: 1600, height: 1000, scale: 1 }],
  ['portrait', { width: 390, height: 844, scale: 2 }],
];
const PORT = 4180;

// One command string: passing arguments alongside `shell: true` is deprecated in Node (DEP0190).
const server = spawn(`npx vite preview --port ${PORT} --strictPort`, { shell: true, stdio: 'ignore' });
const stopServer = () => {
  if (process.platform === 'win32')
    spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
  else server.kill();
};

try {
  await new Promise((resolve) => setTimeout(resolve, 3000));
  const browser = await chromium.launch({ headless: false, args: ['--enable-unsafe-webgpu'] });
  try {
    const shoot = async ({ width, height, scale }, progress, path) => {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale });
      await page.bringToFront();
      await page.goto(`http://localhost:${PORT}/?p=${progress}&tier=3&time=12&bare`);
      await page.waitForFunction(() => (window.__moonlit?.frames() ?? 0) > 60, undefined, { timeout: 120_000 });
      // The sea fades up over 1.2 s once it is ready (overlay.css .world).
      await page.waitForTimeout(1500);
      await page.screenshot({ path, type: 'jpeg', quality: 82 });
      await page.close();
      console.log(`wrote ${path} (${Math.round(statSync(path).size / 1024)} kB)`);
    };
    for (const [name, progress] of PAGES) {
      for (const [shape, viewport] of SHAPES) await shoot(viewport, progress, `public/stills/${name}-${shape}.jpg`);
    }
    await shoot({ width: 1280, height: 800, scale: 1 }, 1, 'public/projects/moonlit-cover.jpg');
  } finally {
    await browser.close();
  }
} finally {
  stopServer();
}
