// Renders the stills fallback, the project cover and the case study's clip and comparison from the real scene
// (spec 2026-09-25 §4.10; storyboard F).
// Usage: npm run build && npm run capture [stills] [cover] [compare] [clip]   (no names: all of them)
// Needs a real GPU, so it opens a visible browser: run it on a real machine, not in CI. The clip and the comparison
// also need ffmpeg on the PATH.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
const wanted = new Set(process.argv.slice(2));
const run = (name) => wanted.size === 0 || wanted.has(name);

const report = (path) => console.log(`wrote ${path} (${Math.round(statSync(path).size / 1024)} kB)`);
const ffmpeg = (args) => {
  const result = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`ffmpeg failed: ${args.join(' ')}`);
};

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
    /** One frame of the scene alone, pinned to a scroll position, a moment and a tier. */
    const shoot = async ({ width, height, scale }, { progress, time = 12, tier = 3, frames = 60 }, path, type) => {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale });
      await page.bringToFront();
      await page.goto(`http://localhost:${PORT}/?p=${progress}&tier=${tier}&time=${time}&bare`);
      await page.waitForFunction((n) => (window.__moonlit?.frames() ?? 0) > n, frames, { timeout: 120_000 });
      // The sea fades up over 1.2 s once it is ready (overlay.css .world); a clip frame skips the fade instead.
      if (frames < 60) await page.addStyleTag({ content: '.world { transition: none !important }' });
      else await page.waitForTimeout(1500);
      await page.screenshot(type === 'png' ? { path, type } : { path, type: 'jpeg', quality: type ?? 82 });
      await page.close();
    };

    if (run('stills')) {
      for (const [name, progress] of PAGES) {
        for (const [shape, viewport] of SHAPES) {
          const path = `public/stills/${name}-${shape}.jpg`;
          await shoot(viewport, { progress }, path);
          report(path);
        }
      }
    }
    if (run('cover')) {
      await shoot({ width: 1280, height: 800, scale: 1 }, { progress: 1 }, 'public/projects/moonlit-cover.jpg');
      report('public/projects/moonlit-cover.jpg');
    }

    const scratch = mkdtempSync(join(tmpdir(), 'moonlit-capture-'));
    try {
      // The hard part, shown: the same full-moon moment at the lowest tier and at tier 3, cropped side by side
      // around the moon's path and the wet sand, where the difference in sharpness shows.
      if (run('compare')) {
        const view = { width: 1280, height: 800, scale: 1 };
        await shoot(view, { progress: 0.8348, tier: 0 }, join(scratch, 'tier0.png'), 'png');
        await shoot(view, { progress: 0.8348, tier: 3 }, join(scratch, 'tier3.png'), 'png');
        const path = 'public/projects/moonlit-tiers.jpg';
        ffmpeg([
          '-i',
          join(scratch, 'tier0.png'),
          '-i',
          join(scratch, 'tier3.png'),
          '-filter_complex',
          '[0]crop=560:440:580:300[a];[1]crop=560:440:580:300[b];[a][b]hstack,drawbox=x=559:y=0:w=2:h=ih:color=white@0.7:t=fill',
          '-q:v',
          '4',
          path,
        ]);
        report(path);
      }

      // Sea to shore: six seconds of the journey, 24 frames a second, each one rendered alone at its own scroll
      // position and moment, so the clip is smooth whatever the machine's frame rate.
      if (run('clip')) {
        const frames = join(scratch, 'frames');
        mkdirSync(frames);
        const count = 144;
        for (let i = 0; i < count; i++) {
          const t = i / (count - 1);
          const eased = t * t * (3 - 2 * t);
          const progress = (0.12 + (0.4 - 0.12) * eased).toFixed(5);
          const time = (12 + (6 * i) / count).toFixed(4);
          await shoot(
            { width: 1280, height: 720, scale: 1 },
            { progress, time, frames: 3 },
            join(frames, `f${String(i).padStart(3, '0')}.png`),
            'png',
          );
          if (i % 24 === 0) console.log(`clip frame ${i}/${count}`);
        }
        const path = 'public/projects/moonlit-voyage.mp4';
        ffmpeg([
          '-framerate',
          '24',
          '-i',
          join(frames, 'f%03d.png'),
          '-vf',
          'scale=960:-2',
          '-c:v',
          'libx264',
          '-preset',
          'slow',
          '-crf',
          '24',
          '-pix_fmt',
          'yuv420p',
          '-movflags',
          '+faststart',
          '-an',
          path,
        ]);
        report(path);
        const poster = 'public/projects/moonlit-voyage-poster.jpg';
        ffmpeg(['-i', join(frames, 'f000.png'), '-vf', 'scale=960:-2', '-q:v', '4', poster]);
        report(poster);
      }
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  } finally {
    await browser.close();
  }
} finally {
  stopServer();
}
