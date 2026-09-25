import { percentile } from '../quality/governor';

export interface HudInfo {
  backend: string;
  tier: number;
  renderScale: number;
  progress: number;
  scrolling: boolean;
  /** The measured display refresh and the frame rate the pacer renders at (app/refresh.ts). */
  refresh: string;
}

export interface Hud {
  record(frameMs: number, scrolling: boolean): void;
  /** Call when the governor changes tier, so a change during a scroll shows up as a regression. */
  tierChanged(scrolling: boolean): void;
  paint(nowMs: number, info: HudInfo): void;
}

/** Frame-time overlay for real-device testing (spec §7). Shows the numbers the governor acts on. */
export function createHud(parent: HTMLElement): Hud {
  const element = document.createElement('div');
  element.className = 'hud';
  element.setAttribute('aria-hidden', 'true');
  parent.append(element);

  const frames: number[] = [];
  let dropped = 0;
  let droppedInScroll = 0;
  let tierChangesInScroll = 0;
  let lastPaint = 0;

  return {
    record(frameMs, scrolling) {
      frames.push(frameMs);
      if (frames.length > 240) frames.shift();
      if (frameMs > 25) {
        dropped += 1;
        if (scrolling) droppedInScroll += 1;
      }
    },
    tierChanged(scrolling) {
      if (scrolling) tierChangesInScroll += 1;
    },
    paint(nowMs, info) {
      if (nowMs - lastPaint < 500 || frames.length === 0) return;
      lastPaint = nowMs;
      const median = percentile(frames, 0.5);
      const slow = percentile(frames, 0.95);
      element.textContent = [
        `backend   ${info.backend}`,
        `tier      ${info.tier}  (render scale ${info.renderScale})`,
        `display   ${info.refresh}`,
        `fps       ${Math.round(1000 / median)}`,
        `frame ms  p50 ${median.toFixed(1)}  p95 ${slow.toFixed(1)}`,
        `dropped   ${dropped}  (frames > 25 ms)`,
        `scroll    ${info.scrolling ? 'moving' : 'still'}`,
        `in scroll ${droppedInScroll} long frames (> 25 ms)`,
        `tier changes in scroll ${tierChangesInScroll}`,
        `progress  ${info.progress.toFixed(3)}`,
      ].join('\n');
    },
  };
}
