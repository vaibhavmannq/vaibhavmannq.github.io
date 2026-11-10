import { ImageBitmapLoader, LinearFilter, NoColorSpace, RepeatWrapping, Texture } from 'three/webgpu';
import type { FrameState } from '../journey/timeline';
import { STOP_IDS } from '../journey/types';
import type { Manifest, SkyAmbient } from './manifest';

const LAST = STOP_IDS.length - 1;
const inRange = (i: number) => i >= 0 && i <= LAST;

/** The skies to keep loaded: the current stop (or both ends of a flight) first, then its neighbours (spec §12). */
export function skiesToHold(stopIndex: number, kind: 'stop' | 'flight', b: number): number[] {
  const order = kind === 'stop' ? [stopIndex, stopIndex + 1, stopIndex - 1] : [stopIndex, b, b + 1, stopIndex - 1];
  return [...new Set(order)].filter(inRange);
}

/** While a sky is still loading, show the nearest loaded one on the journey, never a black or missing sky. */
export function pickSkyTexture<T>(want: number, loaded: ReadonlyMap<number, T>, fallback: T): T {
  let best: T = fallback;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const [index, value] of loaded) {
    const d = Math.abs(index - want);
    if (d < bestDistance) {
      bestDistance = d;
      best = value;
    }
  }
  return best;
}

export function skyAmbients(manifest: Manifest): SkyAmbient[] {
  return STOP_IDS.map((id) => {
    const sky = manifest.skies[id];
    if (!sky) throw new Error(`manifest has no sky for ${id}`);
    return { ambientSky: sky.ambientSky, ambientGround: sky.ambientGround };
  });
}

export interface SkyStore {
  /** The texture to draw for stop `index`: its own when loaded, else the nearest loaded one. */
  get(index: number): Texture;
  /** Start the loads this frame needs and release skies that are no longer near. */
  update(frame: FrameState): void;
  /** Resolves when stop `index`'s own sky is on the GPU side. */
  ready(index: number): Promise<void>;
}

/** Sky photos are 8-bit HDR-encoded data, not colours: no colour space, no mipmaps, wrapped around the horizon. */
function prepare(t: Texture): Texture {
  t.colorSpace = NoColorSpace;
  t.wrapS = RepeatWrapping;
  t.generateMipmaps = false;
  t.minFilter = LinearFilter;
  t.magFilter = LinearFilter;
  return t;
}

export function createSkyStore(manifest: Manifest, fallback: Texture, base = '/world/'): SkyStore {
  // ImageBitmapLoader decodes the 2048 px JPEGs off the main thread; an <img> decoded them on the first draw, mid-flight
  // (a 51 ms frame on the first visit, M0 measurement). The bitmap is flipped while decoding, so the texture is not.
  const loader = new ImageBitmapLoader();
  loader.setOptions({ imageOrientation: 'flipY' });
  const loaded = new Map<number, Texture>();
  const pending = new Map<number, Promise<Texture>>();

  const load = (index: number): Promise<Texture> => {
    const have = loaded.get(index);
    if (have) return Promise.resolve(have);
    let p = pending.get(index);
    if (!p) {
      const id = STOP_IDS[index];
      const file = id ? manifest.skies[id]?.file : undefined;
      if (!file) return Promise.reject(new Error(`no sky ${index}`));
      p = loader.loadAsync(base + file).then((bitmap) => {
        const t = new Texture(bitmap);
        t.flipY = false;
        t.needsUpdate = true;
        pending.delete(index);
        loaded.set(index, prepare(t));
        return t;
      });
      pending.set(index, p);
    }
    return p;
  };

  return {
    get: (index) => pickSkyTexture(index, loaded, fallback),
    update(frame) {
      const hold = skiesToHold(frame.a, frame.kind, frame.b);
      for (const i of hold) void load(i).catch((error: unknown) => console.warn('sky failed to load', i, error));
      for (const [i, t] of loaded)
        if (!hold.includes(i)) {
          t.dispose();
          (t.image as ImageBitmap | null)?.close?.();
          loaded.delete(i);
        }
    },
    ready: (index) => load(index).then(() => undefined),
  };
}
