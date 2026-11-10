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
  /** A still may show only once it is decoded: decoding a 1920 px WebP on its first paint cost the phone a 50–100 ms
   *  frame at every place (s04, 6x-slowed run: 6 slow frames with stills, 1 without). */
  const decoded = images.map(() => false);
  const lastOpacity = images.map(() => -1);
  let jumpVeil = 0;
  let label = '';
  let lastPlace = -1;
  let lastVeil = -1;

  return {
    /** `stillsOn` is false under `?stills=off`; with no GPU the nearest still always shows. */
    update(frame: FrameState, nearest: number, stillsOn: boolean) {
      const noGpu = html.classList.contains('is-stills');
      const shown = noGpu ? nearest : frame.t < 0.5 ? frame.a : frame.b;
      const weight = noGpu ? 1 : stillsOn ? frame.stillWeight : 0;
      images.forEach((img, i) => {
        // Load lazily: only the stops next to where the visitor is.
        if (!img.src && Math.abs(i - shown) <= 1 && (stillsOn || noGpu)) {
          img.src = img.dataset.src ?? '';
          img
            .decode()
            .then(() => {
              decoded[i] = true;
            })
            .catch(() => undefined);
        }
        const opacity = i === shown && decoded[i] ? weight : 0;
        // Write only what changed: the overlay runs every vsync, up to 144 times a second.
        if (opacity === lastOpacity[i]) return;
        lastOpacity[i] = opacity;
        img.style.opacity = String(opacity);
        img.dataset.shown = String(opacity > 0.5);
      });
      const stop = stops[shown];
      const text = stop ? `${stop.numeral} · ${stop.hour} · ${stop.place}` : '';
      if (text !== label) {
        place.textContent = text;
        label = text;
      }
      const placeOpacity = noGpu ? 1 : Math.max(frame.stillWeight, frame.resting ? 1 : 0);
      if (placeOpacity !== lastPlace) {
        place.style.opacity = String(placeOpacity);
        lastPlace = placeOpacity;
      }
      const veilOpacity = Math.max(frame.fade, jumpVeil);
      if (veilOpacity !== lastVeil) {
        veil.style.opacity = String(veilOpacity);
        lastVeil = veilOpacity;
      }
    },
    setVeil(opacity: number) {
      jumpVeil = opacity;
    },
  };
}
