import type { App } from '../app/boot';
import { STOPS } from '../journey/stops';
import type { FrameState } from '../journey/timeline';
import { TIER_NAMES, type Tier } from '../quality/tiers';

/**
 * `?hud`: the measuring panel. fps and the worst frame over the last second, draws, triangles, tier, backend, where on
 * the journey, and world bytes loaded; buttons for the three tiers and the stills. The clock starts at the first
 * rendered frame, so loading never counts as a frame (s02 lesson).
 */
export function installHud(app: App): void {
  const panel = document.createElement('div');
  panel.className = 'hud';
  const text = document.createElement('pre');
  const buttons = document.createElement('div');
  const tierButtons = TIER_NAMES.map((name, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = name;
    b.addEventListener('click', () => app.setTier(i as Tier));
    return b;
  });
  const stills = document.createElement('button');
  stills.type = 'button';
  stills.addEventListener('click', () => {
    app.stills = !app.stills;
  });
  buttons.append(...tierButtons, stills);
  panel.append(text, buttons);
  document.body.append(panel);

  let frames: number[] = [];
  let windowStart = -1;
  let fps = 0;
  let worst = 0;
  let lastText = 0;
  const where = (f: FrameState) => {
    const a = STOPS[f.a]?.numeral ?? '';
    const b = STOPS[f.b]?.numeral ?? '';
    return f.kind === 'stop' ? `stop ${a}` : `flight ${a}→${b} ${f.t.toFixed(2)}`;
  };

  app.onFrame.push((f, nowMs, dtMs) => {
    if (windowStart < 0) {
      windowStart = nowMs;
      return;
    }
    frames.push(dtMs);
    if (nowMs - windowStart >= 1000) {
      fps = (frames.length * 1000) / (nowMs - windowStart);
      worst = Math.max(...frames);
      frames = [];
      windowStart = nowMs;
    }
    if (nowMs - lastText < 500) return;
    lastText = nowMs;
    const info = app.pipeline?.renderer.info.render;
    const bytes = performance
      .getEntriesByType('resource')
      .filter((e) => e.name.includes('/world/'))
      .reduce(
        (sum, e) =>
          sum +
          ((e as PerformanceResourceTiming).transferSize || (e as PerformanceResourceTiming).encodedBodySize || 0),
        0,
      );
    text.textContent = [
      `${fps.toFixed(0)} fps  worst ${worst.toFixed(1)} ms`,
      `draws ${info?.drawCalls ?? 0}  tris ${((info?.triangles ?? 0) / 1e6).toFixed(2)} M`,
      `${TIER_NAMES[app.tier]}  ${app.pipeline?.backend ?? 'no gpu'}`,
      where(f),
      `world ${(bytes / 1e6).toFixed(2)} MB`,
    ].join('\n');
    tierButtons.forEach((b, i) => {
      b.ariaPressed = String(i === app.tier);
    });
    stills.textContent = app.stills ? 'stills on' : 'stills off';
  });
}
