import { cameraPosition, Fn, float, If, mix, normalWorld, positionWorld, smoothstep, uniform, vec2 } from 'three/tsl';
import {
  DataArrayTexture,
  LinearFilter,
  NoColorSpace,
  type Node,
  RGBAFormat,
  UnsignedByteType,
  Vector2,
} from 'three/webgpu';
import { toThree, type Vec3 } from '../journey/types';
import { slotTexture } from './slotTexture';

/**
 * Baked light (plan world-to-100 Task 11, C5): the key light's soft shadows and the sky's occlusion, worked out once by
 * tools/world/bake_light.py. Each texel holds the height above which a point there sees the key light (h), the penumbra's
 * half-width in height (w), and the share of the sky it sees (ao). A point at height z is lit by smoothstep(h − w, h + w,
 * z), so grass, rocks and trees at any height read the same map. One map per hour whose key can cast a shadow (Golden,
 * Sunset, Night, Midnight, Sunrise), over the whole base at 4 m and that hour's place at 1 m; a ride blends the two
 * maps whose keys lie nearest the light now (ruling s29: shadows hold through rides).
 */

export interface LightMapMeta {
  lo: number;
  /** metres per step of the 16-bit shadow height */
  hStep: number;
  coarse: { x0: number; y0: number; step: number; nx: number; ny: number };
  fine: { step: number; n: number };
  hours: string[];
  /** toward each hour's key light, coast axes (x east, y north, z up) */
  keys: Record<string, Vec3>;
  /** each hour's fine window: its south-west corner, coast metres */
  windows: Record<string, [number, number]>;
  files: { keyCoarse: string; keyFine: string; aoCoarse: string; aoFine: string };
}

const DEG = Math.PI / 180;
/** A map whose key is further than this from the light now weighs nothing (plan Task 11). */
export const BLEND_REACH = 10 * DEG;
/** …and weighs fully inside this. */
const BLEND_FULL = 5 * DEG;
/** Where a shaded point is looked up: moved off its surface along its normal, so a sunny face never shades itself. */
const NORMAL_OFFSET = 0.5;
/**
 * …and further off a steep face (up to 3 m off a vertical one): the big rocks are solid height in the bake (2 m cells,
 * filtered), so a cliff's own sunny face read its own top and went black (s30, Golden's headland).
 */
const FACE_OFFSET = 2.5;
/**
 * How deep each hour's baked shadow goes (1: the key wholly blocked). An art knob, as games set shadow strength per time
 * of day: at Sunset the sun is 1° up and the rise shades the whole meadow, which went muddy against the render's warm
 * foreground (s30), so its shadows let some of the sun through.
 */
export const SHADOW_DEPTH: Readonly<Record<string, number>> = {
  golden: 1,
  sunset: 0.55,
  night: 1,
  midnight: 1,
  sunrise: 1,
};
/** The fine map hands over to the coarse one over this many metres inside its edge. */
const FINE_EDGE = 32;
/** Within this many metres of the eye a shadow reads four texels and blends them; past it, one (s30: -0.x ms). */
const NEAR_TAPS = 200;

const sstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
const angle = (a: Vec3, b: Vec3) => {
  const la = Math.hypot(...a) || 1;
  const lb = Math.hypot(...b) || 1;
  return Math.acos(Math.min(1, Math.max(-1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (la * lb))));
};

/**
 * Pure: which two maps to read for the key light now and how. `a` is the nearest map, `b` the next; `t` the share of
 * b; `weight` how much of the blended shadow shows (1 within 5° of a map's key, 0 beyond 10°: a light far from every
 * baked one, as when the moon hands over to another moon, shows no baked shadow rather than a wrong one).
 */
export function shadowBlend(keyNow: Vec3, keys: readonly Vec3[]): { a: number; b: number; t: number; weight: number } {
  if (keys.length === 0) return { a: 0, b: 0, t: 0, weight: 0 };
  const order = keys.map((k, i) => ({ i, ang: angle(keyNow, k) })).sort((p, q) => p.ang - q.ang);
  const first = order[0] as { i: number; ang: number };
  const second = order[1] ?? first;
  const reach = (ang: number) => sstep(BLEND_REACH, BLEND_FULL, ang);
  // inverse-angle weights, each faded by its reach: continuous as the key moves and as maps come into reach
  const qa = reach(first.ang) / Math.max(first.ang, 1e-4);
  const qb = second === first ? 0 : reach(second.ang) / Math.max(second.ang, 1e-4);
  return {
    a: first.i,
    b: second.i,
    t: qa + qb > 0 ? qb / (qa + qb) : 0,
    weight: reach(first.ang),
  };
}

/**
 * Pure: how much a key of this strength (light.ts keyStrength) needs its shadow: none for a key that is off (a sun below
 * the horizon), so the shader skips the reads (s30: First light's sun lies 5° from Golden's and read its maps for
 * nothing; on the phone the ride on to Sunrise fell to 52 fps).
 */
export function keyShines(keyStrength: number): number {
  const t = Math.min(1, Math.max(0, (keyStrength - 0.02) / 0.18));
  return t * t * (3 - 2 * t);
}

/** Pure: a texel's shadow height and penumbra from its bytes (bake_light.py encode_key). */
export function decodeTexel(r: number, g: number, b: number, lo: number, hStep: number): { h: number; w: number } {
  return { h: lo + (r * 256 + g) * hStep, w: b / 10 };
}

/** A decoded map for the CPU twin (tests): texel centres at x0 + (i + 0.5) · step. */
export interface PlainMap {
  x0: number;
  y0: number;
  step: number;
  nx: number;
  ny: number;
  h: ArrayLike<number>;
  w: ArrayLike<number>;
  ao: ArrayLike<number>;
}

/** Pure twin of the shader's lookup: each of the four texels' shadow at height z, blended bilinearly; 1 outside. */
export function bakedAt(map: PlainMap | null, x: number, y: number, z: number): { shadow: number; ao: number } {
  if (!map) return { shadow: 1, ao: 1 };
  if (x < map.x0 || y < map.y0 || x > map.x0 + map.nx * map.step || y > map.y0 + map.ny * map.step)
    return { shadow: 1, ao: 1 };
  const fx = (x - map.x0) / map.step - 0.5;
  const fy = (y - map.y0) / map.step - 0.5;
  const i = Math.min(Math.max(Math.floor(fx), 0), map.nx - 2);
  const j = Math.min(Math.max(Math.floor(fy), 0), map.ny - 2);
  const u = Math.min(Math.max(fx - i, 0), 1);
  const v = Math.min(Math.max(fy - j, 0), 1);
  let shadow = 0;
  let ao = 0;
  for (const [di, dj, wt] of [
    [0, 0, (1 - u) * (1 - v)],
    [1, 0, u * (1 - v)],
    [0, 1, (1 - u) * v],
    [1, 1, u * v],
  ] as const) {
    const k = (j + dj) * map.nx + i + di;
    const h = map.h[k] as number;
    const w = map.w[k] as number;
    shadow += wt * sstep(h - w, h + w, z);
    ao += wt * (map.ao[k] as number);
  }
  return { shadow, ao };
}

type F = Node<'float'>;
type V2 = Node<'vec2'>;

function placeholder(): DataArrayTexture {
  // lit everywhere (h = lo), the whole sky seen
  const t = new DataArrayTexture(new Uint8Array([0, 0, 3, 255]), 1, 1, 1);
  return setUp(t);
}

function setUp(t: DataArrayTexture): DataArrayTexture {
  t.format = RGBAFormat;
  t.type = UnsignedByteType;
  // Linear, read only at texel centres (so each read is that texel's bytes): with Nearest on both, three r186 takes the
  // textureLoad path for "unfilterable" textures, whose cached size variable leaks between materials (s30: the meadow
  // and grove shaders failed with "unresolved value nodeUniformN").
  t.magFilter = LinearFilter;
  t.minFilter = LinearFilter;
  t.generateMipmaps = false;
  t.colorSpace = NoColorSpace;
  t.flipY = false;
  t.needsUpdate = true;
  return t;
}

/** Packs decoded RGBA images (hours stacked top to bottom, north up) into one layered texture, rows south to north. */
export function packLayers(
  key: { data: Uint8ClampedArray; width: number; height: number },
  ao: { data: Uint8ClampedArray; width: number; height: number },
  layers: number,
  aoLayers: number,
): DataArrayTexture {
  const w = key.width;
  const h = key.height / layers;
  const out = new Uint8Array(w * h * layers * 4);
  for (let l = 0; l < layers; l++) {
    const al = Math.min(l, aoLayers - 1);
    for (let j = 0; j < h; j++) {
      const src = ((l + 1) * h - 1 - j) * w * 4; // north-up image row → grid row j
      const asrc = ((al + 1) * h - 1 - j) * w * 4;
      const dst = (l * h + j) * w * 4;
      for (let i = 0; i < w; i++) {
        out[dst + i * 4] = key.data[src + i * 4] as number;
        out[dst + i * 4 + 1] = key.data[src + i * 4 + 1] as number;
        out[dst + i * 4 + 2] = key.data[src + i * 4 + 2] as number;
        out[dst + i * 4 + 3] = ao.data[asrc + i * 4] as number;
      }
    }
  }
  return setUp(new DataArrayTexture(out, w, h, layers));
}

/**
 * The baked light as TSL: `shadow` (the key's share, 0..1) and `ao` (the sky's share) at the shaded point, from
 * placeholder maps until `setMaps` hands over the real ones (the shaders never change: the texture slots keep their
 * names, R121's slotTexture). `update(keyDir)` picks the maps for the light now, three.js axes.
 */
export function createBakedLight() {
  const coarseTex = slotTexture(placeholder(), 'baked-coarse');
  const fineTex = slotTexture(placeholder(), 'baked-fine');
  const u = {
    layerA: uniform(0, 'int'),
    layerB: uniform(0, 'int'),
    t: uniform(0),
    weight: uniform(0),
    fineA: uniform(new Vector2(1e7, 1e7)),
    fineB: uniform(new Vector2(1e7, 1e7)),
    fineN: uniform(1),
    fineStep: uniform(1),
    coarse0: uniform(new Vector2(1e7, 1e7)),
    coarseN: uniform(new Vector2(1, 1)),
    coarseStep: uniform(4),
    lo: uniform(0),
    hStep: uniform(0.1),
  };
  let keys: Vec3[] = [];
  let windows: [number, number][] = [];
  let depths: number[] = [];

  /**
   * The key's share at height z from four texels around xy in one layer, each decoded and tested, then blended
   * bilinearly (a 16-bit height split over two bytes cannot be filtered by the hardware). `oneTexel`: the nearest
   * texel alone, a quarter of the reads, for plants (per vertex, on grass, its 1 m / 4 m steps never show).
   */
  const shadowLookup = (
    tex: typeof coarseTex,
    layer: Node<'int'>,
    origin: V2,
    step: F,
    size: V2,
    xy: V2,
    z: F,
    oneTexel: boolean,
    /** past NEAR_TAPS metres one texel is enough (a 4 m texel is under a pixel there); null: always four */
    far: F | null,
  ): F => {
    const nearest = (): F => {
      const at = xy.sub(origin).div(step).floor().clamp(vec2(0), size.sub(1)).add(0.5).div(size);
      const c = tex.sample(at).depth(layer);
      const h = c.r
        .mul(255 * 256)
        .add(c.g.mul(255))
        .mul(u.hStep)
        .add(u.lo);
      const w = c.b.mul(25.5);
      return smoothstep(h.sub(w), h.add(w), z) as F;
    };
    if (oneTexel) return nearest();
    const out = float(1).toVar();
    const four = () => {
      const f = xy.sub(origin).div(step).sub(0.5);
      const i0 = f.floor().clamp(vec2(0), size.sub(2));
      const fr = f.sub(i0).clamp(0, 1);
      const texel = (di: number, dj: number) => {
        const c = tex.sample(i0.add(vec2(di + 0.5, dj + 0.5)).div(size)).depth(layer);
        const h = c.r
          .mul(255 * 256)
          .add(c.g.mul(255))
          .mul(u.hStep)
          .add(u.lo);
        const w = c.b.mul(25.5);
        return smoothstep(h.sub(w), h.add(w), z);
      };
      const bottom = mix(texel(0, 0), texel(1, 0), fr.x);
      const top = mix(texel(0, 1), texel(1, 1), fr.x);
      out.assign(mix(bottom, top, fr.y));
    };
    if (!far) {
      four();
    } else {
      If(far, () => {
        out.assign(nearest());
      }).Else(four);
    }
    return out as unknown as F;
  };
  /** The sky's share: one read, filtered by the hardware (a plain byte; the textures are linear, s30). */
  const aoLookup = (tex: typeof coarseTex, layer: Node<'int'>, origin: V2, step: F, size: V2, xy: V2): F =>
    tex.sample(xy.sub(origin).div(step).div(size)).depth(layer).a as F;
  /** 0 outside a window, 1 deeper than `edge` metres inside it. */
  const inside = (xy: V2, origin: V2, extent: V2, edge: number): F => {
    const d = xy.sub(origin).min(origin.add(extent).sub(xy));
    return smoothstep(0, edge, d.x.min(d.y)) as F;
  };
  /** One layer's value at xy: the fine map inside its window, the coarse one outside, 1 beyond both. */
  const layered = (fineOrigin: V2, xy: V2, read: (tex: typeof coarseTex, origin: V2, step: F, size: V2) => F): F => {
    const out = float(1).toVar();
    const fw = inside(xy, fineOrigin, vec2(u.fineN.mul(u.fineStep)), FINE_EDGE);
    If(fw.lessThan(1), () => {
      const cw = inside(xy, u.coarse0, u.coarseN.mul(u.coarseStep), 8);
      out.assign(mix(float(1), read(coarseTex, u.coarse0, u.coarseStep, u.coarseN), cw));
    });
    If(fw.greaterThan(0), () => {
      out.assign(mix(out, read(fineTex, fineOrigin, u.fineStep, vec2(u.fineN)), fw));
    });
    return out as unknown as F;
  };

  /**
   * The key's share at a point (three.js axes, already off its surface): read only while a baked key is in reach (a
   * uniform branch: Dusk, Blue hour, First light and Before dawn skip it), and the second map only mid-blend.
   */
  const makeShadowAt = (oneTexel: boolean) =>
    Fn(([p]: [Node<'vec3'>]) => {
      const xy = vec2(p.x, p.z.negate());
      const z = p.y as F;
      const far = oneTexel ? null : (cameraPosition.sub(p).length().greaterThan(NEAR_TAPS) as unknown as F);
      const s = float(1).toVar();
      If(u.weight.greaterThan(0.001), () => {
        const read = (layer: Node<'int'>) => (tex: typeof coarseTex, o: V2, st: F, size: V2) =>
          shadowLookup(tex, layer, o, st, size, xy, z, oneTexel, far);
        const v = layered(u.fineA, xy, read(u.layerA)).toVar();
        If(u.t.greaterThan(0.001), () => {
          v.assign(mix(v, layered(u.fineB, xy, read(u.layerB)), u.t));
        });
        s.assign(mix(float(1), v, u.weight));
      });
      return s;
    });
  const shadowAt = makeShadowAt(false);
  const plantShadowAt = makeShadowAt(true);
  /** The sky's share at a point: the same in every hour's map, so the nearest map's layer alone. */
  const aoAt = Fn(([p]: [Node<'vec3'>]) => {
    const xy = vec2(p.x, p.z.negate());
    return layered(u.fineA, xy, (tex, o, st, size) => aoLookup(tex, u.layerA, o, st, size, xy));
  });
  const steep = float(1).sub(normalWorld.y.abs());
  const off = positionWorld.add(normalWorld.mul(steep.mul(FACE_OFFSET).add(NORMAL_OFFSET)));

  return {
    /** the key light's share at the shaded point (1 = lit) */
    shadow: shadowAt(off) as F,
    /** the sky's share at the shaded point (1 = open sky) */
    ao: aoAt(off) as F,
    /** (shadow, ao) at any point: for parts that light themselves per vertex (meadow, grove), whose normals are bent */
    at: (p: Node<'vec3'>) => vec2(plantShadowAt(p), aoAt(p)) as Node<'vec2'>,
    uniforms: u,
    get ready() {
      return keys.length > 0;
    },
    setMaps(meta: LightMapMeta, coarse: DataArrayTexture, fine: DataArrayTexture) {
      coarseTex.value = coarse;
      fineTex.value = fine;
      keys = meta.hours.map((h) => toThree(meta.keys[h] as Vec3));
      windows = meta.hours.map((h) => meta.windows[h] as [number, number]);
      depths = meta.hours.map((h) => SHADOW_DEPTH[h] ?? 1);
      u.fineN.value = meta.fine.n;
      u.fineStep.value = meta.fine.step;
      u.coarse0.value.set(meta.coarse.x0, meta.coarse.y0);
      u.coarseN.value.set(meta.coarse.nx, meta.coarse.ny);
      u.coarseStep.value = meta.coarse.step;
      u.lo.value = meta.lo;
      u.hStep.value = meta.hStep;
    },
    /** Picks the maps for the key light now (three.js axes). */
    update(keyDir: Vec3, keyStrength = 1) {
      if (keys.length === 0) return;
      const b = shadowBlend(keyDir, keys);
      u.layerA.value = b.a;
      u.layerB.value = b.b;
      u.t.value = b.t;
      u.weight.value = b.weight * ((depths[b.a] ?? 1) * (1 - b.t) + (depths[b.b] ?? 1) * b.t) * keyShines(keyStrength);
      const wa = windows[b.a] as [number, number];
      const wb = windows[b.b] as [number, number];
      u.fineA.value.set(wa[0], wa[1]);
      u.fineB.value.set(wb[0], wb[1]);
    },
  };
}

export type BakedLight = ReturnType<typeof createBakedLight>;

/** Reads a PNG's pixels exactly (no colour management, no premultiplying). */
async function pixels(url: string): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
  const blob = await (await fetch(url)).blob();
  const bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const canvas = new OffscreenCanvas(bmp.width, bmp.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D;
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  return { data: ctx.getImageData(0, 0, canvas.width, canvas.height).data, width: canvas.width, height: canvas.height };
}

/** Fetches and packs the baked maps (public/world/light/), yielding between the steps (the lantern room draws, R216). */
export async function loadBakedMaps(
  base: string,
  yieldTask: () => Promise<void>,
): Promise<{ meta: LightMapMeta; coarse: DataArrayTexture; fine: DataArrayTexture }> {
  const meta = (await (await fetch(`${base}light/light.json`)).json()) as LightMapMeta;
  const [kc, kf, ac, af] = await Promise.all(
    [meta.files.keyCoarse, meta.files.keyFine, meta.files.aoCoarse, meta.files.aoFine].map((f) => pixels(base + f)),
  );
  await yieldTask();
  const n = meta.hours.length;
  const coarse = packLayers(kc as never, ac as never, n, 1);
  await yieldTask();
  const fine = packLayers(kf as never, af as never, n, n);
  return { meta, coarse, fine };
}
