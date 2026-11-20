/**
 * The night cursor (plan M8 Task 8; research/owner-sites.md M8, Originkit "Aura Cursor" and "Ribbon Trails"): a soft
 * glow under the pointer with a short trail, only in the night hours (Blue hour to Before dawn) and only for a mouse or
 * trackpad. The system pointer stays; over links, buttons and the project card the glow steps aside. None under
 * reduced motion. A few DOM dots moved by transform: no canvas, no library.
 */

/** Stops whose hour is night: Blue hour, Night, Deep midnight, Before dawn. */
const NIGHT = new Set([3, 4, 5, 6]);

/** Pure: how much of the night cursor shows, by the light's turn between the frame's two stops. */
export function nightWeight(state: { a: number; b: number; hourWeight: number }): number {
  const wa = NIGHT.has(state.a) ? 1 : 0;
  const wb = NIGHT.has(state.b) ? 1 : 0;
  return wa + (wb - wa) * state.hourWeight;
}

const TRAIL = 7;

export interface NightCursor {
  /** Each rendered frame: the frame's stops and the light's turn. */
  update(state: { a: number; b: number; hourWeight: number }, dtMs: number): void;
}

export function installNightCursor(): NightCursor | null {
  const fine = window.matchMedia?.('(pointer: fine)').matches ?? false;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  if (!fine || reduced) return null;
  const layer = document.createElement('div');
  layer.className = 'night-cursor';
  layer.setAttribute('aria-hidden', 'true');
  const glow = document.createElement('div');
  glow.className = 'night-cursor__glow';
  const dots = Array.from({ length: TRAIL }, (_, i) => {
    const d = document.createElement('div');
    d.className = 'night-cursor__dot';
    d.style.setProperty('--k', String(1 - i / TRAIL));
    layer.append(d);
    return { el: d, x: -100, y: -100 };
  });
  layer.prepend(glow);
  document.body.append(layer);

  let px = -100;
  let py = -100;
  let over = false;
  let seen = false;
  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      px = e.clientX;
      py = e.clientY;
      seen = true;
      over = e.target instanceof Element && e.target.closest('a, button, [role="button"], .card, input') !== null;
    },
    { passive: true },
  );
  document.addEventListener('pointerleave', () => {
    seen = false;
  });

  return {
    update(state, dtMs) {
      const w = seen && !over ? nightWeight(state) : 0;
      layer.style.opacity = w.toFixed(3);
      if (w <= 0.001) return;
      glow.style.transform = `translate3d(${px}px, ${py}px, 0)`;
      // each dot eases toward the one before it: a short trail that shortens as the pointer stops
      let lx = px;
      let ly = py;
      const k = 1 - Math.exp(-dtMs / 45);
      for (const d of dots) {
        d.x += (lx - d.x) * k;
        d.y += (ly - d.y) * k;
        d.el.style.transform = `translate3d(${d.x}px, ${d.y}px, 0)`;
        lx = d.x;
        ly = d.y;
      }
    },
  };
}
