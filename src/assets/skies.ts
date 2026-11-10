import { ImageBitmapLoader, LinearFilter, NoColorSpace, RepeatWrapping, Texture } from 'three/webgpu';
import type { FrameState } from '../journey/timeline';
import { STOP_IDS } from '../journey/types';
import type { Manifest, SkyAmbient } from './manifest';

const LAST = STOP_IDS.length - 1;
const inRange = (i: number) => i >= 0 && i <= LAST;

/** The skies to keep loaded: the current stop (or both ends of a flight) first, then its neighbours (spec §12). */
export function skiesToHold(stopIndex: number, kind: 'stop' | 'flight', b: number): number[] {
  // At a stop also fetch the one after next: a flight then asks for nothing new, so no download, decode or GPU upload
  // lands on a moving frame (s04 phone measurement).
  const order =
    kind === 'stop' ? [stopIndex, stopIndex + 1, stopIndex - 1, stopIndex + 2] : [stopIndex, b, b + 1, stopIndex - 1];
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

export interface SkyStoreOptions {
  base?: string;
  /** How a sky file becomes a texture; tests pass a controllable fake. */
  loadTexture?: (url: string) => Promise<Texture>;
  /** Wait this long before trying a failed download again. */
  retryMs?: number;
  now?: () => number;
  warn?: (...args: unknown[]) => void;
  /**
   * Called when a sky arrives, to send it to the GPU at once. Loads usually finish while the camera rests, so the
   * upload no longer lands on the first frame of a flight (s04: a 50–80 ms frame at every flight start on WebGL2).
   */
  onLoaded?: (texture: Texture) => void;
}

/** ImageBitmapLoader decodes the 2048 px JPEGs off the main thread (an <img> decoded them on the first draw, mid-flight:
 * a 51 ms frame, M0 measurement). The bitmap is flipped while decoding, so the texture is not. */
function bitmapLoader(): (url: string) => Promise<Texture> {
  const loader = new ImageBitmapLoader();
  loader.setOptions({ imageOrientation: 'flipY' });
  return (url) =>
    loader.loadAsync(url).then((bitmap) => {
      const t = new Texture(bitmap);
      t.flipY = false;
      t.needsUpdate = true;
      return t;
    });
}

function release(t: Texture): void {
  t.dispose();
  (t.image as ImageBitmap | null)?.close?.();
}

export function createSkyStore(manifest: Manifest, fallback: Texture, options: SkyStoreOptions = {}): SkyStore {
  const base = options.base ?? '/world/';
  const loadTexture = options.loadTexture ?? bitmapLoader();
  const retryMs = options.retryMs ?? 3000;
  const now = options.now ?? (() => performance.now());
  const warn = options.warn ?? ((...args: unknown[]) => console.warn(...args));
  const loaded = new Map<number, Texture>();
  const pending = new Map<number, Promise<Texture>>();
  /** When each failed download failed: no new attempt until retryMs has passed (I1: no retry storm, one warning). */
  const failedAt = new Map<number, number>();

  const load = (index: number): Promise<Texture> => {
    const have = loaded.get(index);
    if (have) return Promise.resolve(have);
    const inFlight = pending.get(index);
    if (inFlight) return inFlight;
    const id = STOP_IDS[index];
    const file = id ? manifest.skies[id]?.file : undefined;
    if (!file) return Promise.reject(new Error(`no sky ${index}`));
    const p = loadTexture(base + file).then(
      (t) => {
        pending.delete(index);
        failedAt.delete(index);
        loaded.set(index, prepare(t));
        options.onLoaded?.(t);
        return t;
      },
      (error: unknown) => {
        pending.delete(index);
        failedAt.set(index, now());
        warn('sky failed to load', id, error);
        throw error;
      },
    );
    pending.set(index, p);
    return p;
  };

  const mayTry = (index: number) => {
    const at = failedAt.get(index);
    return at === undefined || now() - at >= retryMs;
  };

  return {
    get: (index) => pickSkyTexture(index, loaded, fallback),
    update(frame) {
      const hold = skiesToHold(frame.a, frame.kind, frame.b);
      for (const i of hold) if (mayTry(i)) load(i).catch(() => undefined);
      // Release far skies only once every sky this frame needs has arrived: until then the far ones are what is on
      // screen (C1: releasing them first showed the near-black fallback for the whole download).
      if (!hold.every((i) => loaded.has(i))) return;
      for (const [i, t] of loaded)
        if (!hold.includes(i)) {
          release(t);
          loaded.delete(i);
        }
    },
    ready: (index) => load(index).then(() => undefined),
  };
}
