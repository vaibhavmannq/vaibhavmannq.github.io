import type { Page } from '@playwright/test';

/** Start collecting console errors and uncaught exceptions; read the array at the end of the test. */
export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

/** Wait until boot has published window.__moonlit (after shaders compile, or immediately in stills mode). */
export async function waitForMoonlit(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__moonlit !== undefined, undefined, { timeout: 90_000 });
}

export interface LineContrast {
  text: string;
  /** WCAG AA: 4.5:1 for normal text, 3:1 for large text. */
  required: number;
  ratio: number;
}

interface LineBox {
  text: string;
  rgba: [number, number, number, number];
  large: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Contrast of every visible text line against the pixels actually rendered behind it.
 *
 * How it works: read each line's box and its text colour. Then hide the glyphs (the scene, the
 * floor gradient and the text shadows all stay) and take a screenshot. Each line's background is
 * the 95th-percentile brightest pixel in its box: that ignores a few single-pixel glints, but not
 * a bright moon path. Leaves the page with its text hidden, so measure last.
 */
export async function measureTextContrast(page: Page): Promise<LineContrast[]> {
  const lines = await page.evaluate(() => {
    const out: LineBox[] = [];
    // Links and small labels count too: the Contact page is mostly links (a link inside a paragraph is
    // measured with its own colour).
    const selector = '.section.is-active :is(h1, h2, h3, p, a, button, .contact-list__label):not([aria-hidden="true"])';
    for (const element of document.querySelectorAll<HTMLElement>(selector)) {
      // Measure only text a reader can see: a visually hidden copy for screen readers is squeezed into a
      // 1-pixel box, so its words stack down the page over whatever is there, unseen.
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
        if (node.parentElement?.closest('.visually-hidden') || !node.textContent?.trim()) continue;
        // Each piece of text in its own colour: "See the work" is dark on a light button inside a paragraph of
        // light text, and measuring it in the paragraph's colour read light on light (plan 2, Task 4).
        const style = getComputedStyle(node.parentElement ?? element);
        const size = Number.parseFloat(style.fontSize);
        const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
        const [r = 0, g = 0, b = 0, a = 1] = (style.color.match(/[\d.]+/g) ?? []).map(Number);
        // Only what is on screen: a card scrolled out of a sideways row is clipped by the row, and its text would be
        // measured against whatever scene lies behind that hidden spot (found 2026-09-26: "Coming soon" at 2.87:1).
        let visible = { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
        for (let parent = node.parentElement; parent !== null; parent = parent.parentElement) {
          const overflow = getComputedStyle(parent);
          if (overflow.overflowX === 'visible' && overflow.overflowY === 'visible') continue;
          const clip = parent.getBoundingClientRect();
          visible = {
            left: Math.max(visible.left, clip.left),
            top: Math.max(visible.top, clip.top),
            right: Math.min(visible.right, clip.right),
            bottom: Math.min(visible.bottom, clip.bottom),
          };
        }
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const box of range.getClientRects()) {
          const left = Math.max(box.left, visible.left);
          const top = Math.max(box.top, visible.top);
          const w = Math.min(box.right, visible.right) - left;
          const h = Math.min(box.bottom, visible.bottom) - top;
          if (w < 4 || h < 4) continue;
          const text = node.textContent.trim().slice(0, 40);
          out.push({ text, rgba: [r, g, b, a], large, x: left, y: top, w, h });
        }
      }
    }
    return out;
  });

  await page.addStyleTag({
    content:
      '.section :is(h1, h2, h3, p, a, button, .contact-list__label), .section :is(h1, h2, h3, p, button) * { color: transparent !important; text-decoration-color: transparent !important } :focus-visible { outline: none !important }',
  });
  const screenshot = await page.screenshot({ animations: 'disabled' });

  // Decode the PNG in a blank page with a 2D canvas, so no image library is needed.
  const decoder = await page.context().newPage();
  try {
    return await decoder.evaluate(
      async ({ base64, boxes }) => {
        const image = new Image();
        image.src = `data:image/png;base64,${base64}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('2D canvas unavailable');
        context.drawImage(image, 0, 0);

        const linear = (value: number) => {
          const c = value / 255;
          return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        };
        const luminance = (p: number[]) =>
          0.2126 * linear(p[0] ?? 0) + 0.7152 * linear(p[1] ?? 0) + 0.0722 * linear(p[2] ?? 0);

        return boxes.map((box) => {
          const width = Math.max(1, Math.floor(box.w));
          const height = Math.max(1, Math.floor(box.h));
          const data = context.getImageData(Math.floor(box.x), Math.floor(box.y), width, height).data;
          const pixels: number[][] = [];
          for (let i = 0; i < data.length; i += 4) pixels.push([data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0]);
          pixels.sort((p, q) => luminance(p) - luminance(q));
          const background = pixels[Math.floor(0.95 * (pixels.length - 1))] ?? [0, 0, 0];

          // A translucent text colour is blended over what is behind it, as the browser does.
          const [r, g, b, a] = box.rgba;
          const foreground = [r, g, b].map((channel, i) => channel * a + (background[i] ?? 0) * (1 - a));
          const lighter = Math.max(luminance(foreground), luminance(background));
          const darker = Math.min(luminance(foreground), luminance(background));
          return { text: box.text, required: box.large ? 3 : 4.5, ratio: (lighter + 0.05) / (darker + 0.05) };
        });
      },
      { base64: screenshot.toString('base64'), boxes: lines },
    );
  } finally {
    await decoder.close();
  }
}
