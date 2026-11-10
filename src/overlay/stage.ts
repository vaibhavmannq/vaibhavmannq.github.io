import type { FrameState } from '../journey/timeline';
import type { Stop } from '../journey/types';

/**
 * The HTML over the world: the place label, the stills (M0 shows each place as its render while the camera rests),
 * and the veil used by jumps and by reduced motion's cross-fades.
 */
export function createStage(stops: readonly Stop[], base = '/world/') {
  const place = document.getElementById('place') as HTMLElement;
  const stills = document.getElementById('stills') as HTMLElement;
  const veil = document.getElementById('veil') as HTMLElement;
  const html = document.documentElement;
  const images = stops.map((stop) => {
    const img = document.createElement('img');
    img.alt = '';
    img.decoding = 'async';
    img.dataset.src = `${base}stills/${stop.id}.webp`;
    stills.append(img);
    return img;
  });
  let jumpVeil = 0;
  let label = '';

  return {
    /** `stillsOn` is false under `?stills=off`; with no GPU the nearest still always shows. */
    update(frame: FrameState, nearest: number, stillsOn: boolean) {
      const noGpu = html.classList.contains('is-stills');
      const shown = noGpu ? nearest : frame.t < 0.5 ? frame.a : frame.b;
      const weight = noGpu ? 1 : stillsOn ? frame.stillWeight : 0;
      images.forEach((img, i) => {
        // Load lazily: only the stops next to where the visitor is.
        if (!img.src && Math.abs(i - shown) <= 1 && (stillsOn || noGpu)) img.src = img.dataset.src ?? '';
        const opacity = i === shown ? weight : 0;
        img.style.opacity = String(opacity);
        img.dataset.shown = String(opacity > 0.5);
      });
      const stop = stops[shown];
      const text = stop ? `${stop.numeral} · ${stop.hour} · ${stop.place}` : '';
      if (text !== label) {
        place.textContent = text;
        label = text;
      }
      place.style.opacity = String(noGpu ? 1 : Math.max(frame.stillWeight, frame.resting ? 1 : 0));
      veil.style.opacity = String(Math.max(frame.fade, jumpVeil));
    },
    setVeil(opacity: number) {
      jumpVeil = opacity;
    },
  };
}
