import {
  cameraPosition,
  dot,
  exp,
  Fn,
  float,
  If,
  max,
  mix,
  normalize,
  smoothstep,
  texture,
  uniform,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import {
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  type Node,
  RepeatWrapping,
  RGBAFormat,
  UnsignedByteType,
  Vector2,
  Vector4,
} from 'three/webgpu';
import { STOP_IDS } from '../journey/types';
import type { LightUniforms } from './light';
import { blendWeather, CLOUD_WEATHER, EARTH_R, HIGH_BASE, type SkyMode } from './skyClouds';

type V3 = Node<'vec3'>;
type V2 = Node<'vec2'>;
type F = Node<'float'>;

/** The cloud map's size (tools/world/cloud_map.py). */
export const CLOUD_MAP_N = 512;
/** Metres of sky one tile of each field covers: the shapes, their detail, the weather, the high layer. */
const TILE_SHAPE = 7000;
const TILE_DETAIL = 1700;
const TILE_WEATHER = 42000;
const TILE_HIGH = 16000;
/** The wind aloft never drops under this, m/s: a calm shore under a still sky looked painted (D57). */
const MIN_ALOFT = 8;

/**
 * The cloud map's texture, empty until `fillCloudMap` puts the baked file's pixels in it: the shader is built once
 * against this texture and never rebuilt when the pixels arrive (R121: no new pipeline on a moving frame).
 */
export function cloudMapTexture(): DataTexture {
  const n = CLOUD_MAP_N;
  const t = new DataTexture(new Uint8Array(n * n * 4), n, n, RGBAFormat, UnsignedByteType);
  t.colorSpace = NoColorSpace;
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.magFilter = LinearFilter;
  t.minFilter = LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  // seen edge-on toward the horizon: without it the GPU blurs the field to its mean (~0.5, under every hour's cover
  // threshold) and the clouds vanish everywhere but overhead (s32)
  t.anisotropy = 16;
  t.needsUpdate = true;
  return t;
}

/** Decode a PNG into a texture made empty at its size (main thread: ~5 ms for 512², ~30 ms for 2048 × 1024; once). */
export async function fillCloudMap(t: DataTexture, url: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  const bitmap = await createImageBitmap(await response.blob(), {
    premultiplyAlpha: 'none',
    colorSpaceConversion: 'none',
  });
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('no 2d context');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  (t.image.data as Uint8Array).set(px);
  t.needsUpdate = true;
}

export interface CloudLayer {
  /**
   * `behind` (the sky with its sun, moon and stars) with the clouds over it, along `dir` (normalised, from the camera);
   * `sky` is the clear sky alone in that direction (the clouds' palette and what far clouds fade into).
   */
  over(sky: V3, behind: V3, dir: V3): V3;
  /** Per frame: the weather of the two hours, the wind aloft (coast x east, y north, m/s), seconds since last. */
  update(a: number, b: number, w: number, wind: [number, number], dtS: number): void;
  /** The map's pixels are in: fade the clouds in over a second. */
  ready(): void;
}

/**
 * Task 12c (s32): clouds of our own over the clear sky, on shells around the planet. `deck` one lit layer, `layers`
 * that layer under a high thin one, `volume` the layer marched in four steps. Lit from the hour's own sky: the clear
 * sky's colour toward the key light (sun or moon) is the light on the clouds' lit side, the sky overhead their shade,
 * a silver edge toward the key, and far clouds fade into the sky behind them (aerial perspective).
 * `colorAt(dir)` reads the clear sky (its two photos blended).
 */
export function createCloudLayer(
  u: LightUniforms,
  map: DataTexture,
  mode: SkyMode,
  colorAt: (dir: V3) => V3,
  /** The layer's cover from the hour's (`cards` keeps only the overcast part: the cards carry the rest). */
  coverOf: (c: number) => number = (c) => c,
): CloudLayer {
  // cover, sheet, soft, opacity · base, thick, high, (unused)
  const wA = uniform(new Vector4(0, 0, 0, 0));
  const wB = uniform(new Vector4(1500, 600, 0, 0));
  const carry = uniform(new Vector2());
  const evolve = uniform(new Vector2());
  const shown = uniform(0);
  let fade = 0;
  let readyAt = false;

  const cover = wA.x;
  const sheet = wA.y;
  const soft = wA.z;
  const opacity = wA.w;
  const base = wB.x;
  const thick = wB.y;
  const high = wB.z;

  /** Distance along `dir` to the shell `h` metres up (skyClouds.shellHit, float32-safe). */
  const hit = (dir: V3, h: F): F => {
    const r0 = cameraPosition.y.add(EARTH_R);
    const b = r0.mul(dir.y);
    const c = h.sub(cameraPosition.y).mul(h.add(cameraPosition.y).add(2 * EARTH_R));
    return c.div(b.add(b.mul(b).add(c).max(0).sqrt()).max(1));
  };
  const at = (dir: V3, t: F): V2 => vec2(cameraPosition.x, cameraPosition.z).add(vec2(dir.x, dir.z).mul(t));

  const sample = (p: V2, tile: number, shift: V2) => texture(map, p.add(shift).div(tile));

  /** The low layer's density 0..1 at a point; `h` 0..1 up through it (the volume's steps); `withDetail` erodes edges. */
  const density = (p: V2, h: F, withDetail: boolean): F => {
    const f1 = sample(p, TILE_SHAPE, carry);
    const wx = sample(p, TILE_WEATHER, carry.mul(0.5)).a;
    const shape = mix(f1.r, f1.b, sheet);
    // the map's shapes are rank-equalised (cloud_map.py): a cover c clouds c of the sky; the weather moves it ±20 %
    const cov = cover.mul(wx.mul(0.4).add(0.8)).clamp(0, 1);
    // heaped clouds thin toward their tops (rounded crowns), sheets keep their depth
    const need = float(1)
      .sub(cov)
      .add(h.mul(h).mul(0.35).mul(float(1).sub(sheet)));
    const edge = soft.mul(0.5).add(0.08);
    const d0 = shape.sub(need).div(edge).clamp(0, 1);
    if (!withDetail) return d0;
    const g = sample(p, TILE_DETAIL, carry.mul(1.3).add(evolve)).g;
    return d0.sub(float(1).sub(g).mul(0.3).mul(float(1).sub(d0))).clamp(0, 1);
  };

  const over = (sky: V3, behind: V3, dir: V3): V3 => {
    const key = u.keyDir as unknown as V3;
    const keyXZ = normalize(vec2(key.x, key.z).add(vec2(0.0001, 0)));
    // the hour's light on a cloud: the clear sky toward the key, a little above the horizon; the shade: the sky overhead
    const glow = colorAt(normalize(vec3(key.x, key.y.max(0.07), key.z)));
    const zenith = colorAt(normalize(vec3(0.02, 1, 0.01)));
    // the light's hue from the glow, its strength capped: the glow itself is far brighter than any lit cloud face, and a
    // cloud is never more than 2.5x the sky around it (s32: at Midnight the moon's glow lit them glaring white)
    const lum = (c: V3): F => dot(c, vec3(0.2126, 0.7152, 0.0722)).max(1e-4);
    const glowLum = lum(glow);
    const litCol = glow.div(glowLum).mul(
      glowLum
        .mul(0.7)
        .min(2.2)
        .min(lum(zenith).max(lum(sky)).mul(2.5)),
    );
    // a cloud's shaded side is lit by the sky overhead, not by the glow behind it: toward the sun it reads darker than
    // the sky, as in the photos (s32: shaded from the local sky, clouds vanished into Golden's glow)
    const shadeCol = mix(zenith, sky, 0.2).mul(0.85);
    const cosK = dot(dir, key);
    const forward = max(cosK, 0).pow(6);
    // the key below the horizon still lights cloud from beneath for a while (twilight), never zero
    const keyVis = smoothstep(-0.12, 0.08, key.y).mul(0.65).add(0.35);
    const above = smoothstep(0.0, 0.035, dir.y);

    // toward the key a cloud is backlit: thick cores go dark, thin edges glow (the silver lining); away from it, the
    // lit side faces the eye
    const backlit = smoothstep(0.2, 0.9, cosK);
    const silver = max(cosK, 0).pow(20).mul(1.6);
    const shade = (d: F, toward: F, depthK: F): V3 => {
      const tk = exp(toward.mul(depthK).negate());
      const thin = float(1).sub(d);
      const direct = litCol
        .mul(tk)
        .mul(keyVis)
        .mul(mix(float(0.8), float(0.18), backlit));
      return shadeCol
        .mul(thin.mul(0.5).add(0.5))
        .add(direct)
        .add(litCol.mul(silver).mul(thin.pow(1.5)));
    };

    // the low layer
    const deck = (): ReturnType<typeof vec4> => {
      const t = hit(dir, base.add(thick.mul(0.5)));
      const p = at(dir, t);
      const aer = float(1).sub(exp(t.div(55000).negate()));
      // the look toward the key is longer when the key is low (light crosses more cloud)
      const step = float(650).add(float(1).sub(key.y.abs()).mul(500));
      const depthK = thick.div(380);
      if (mode === 'volume') {
        const STEPS = 4;
        let acc: V3 = vec3(0);
        let trans: F = float(1);
        for (let i = 0; i < STEPS; i++) {
          const h = (i + 0.5) / STEPS;
          const pi = at(dir, hit(dir, base.add(thick.mul(h))));
          const d = density(pi, float(h), true);
          const toward = density(pi.add(keyXZ.mul(step)), float(Math.min(1, h + 0.25)), false);
          const a = d.mul(opacity).mul(0.5);
          const c = shade(d, toward, depthK).mul(float(0.85).add(h * 0.3));
          acc = acc.add(c.mul(a).mul(trans));
          trans = trans.mul(float(1).sub(a));
        }
        const alpha = float(1).sub(trans);
        const col = mix(acc.div(alpha.max(0.001)), sky, aer.mul(0.85));
        return vec4(col, alpha.mul(above).mul(shown));
      }
      const d = density(p, float(0.5), true);
      const toward = density(p.add(keyXZ.mul(step)), float(0.7), false);
      const col = mix(shade(d, toward, depthK), sky, aer.mul(0.85));
      return vec4(col, d.mul(opacity).mul(above).mul(shown));
    };

    // Premultiplied colour + coverage, put over `behind` outside the Fn; a uniform branch skips every read when the
    // hour has no cloud (`cards` keeps the deck only for overcast hours). s32: an If here once drew no sky at all; the
    // cause was the star field reading `col` through a closure (sky.ts), not the If.
    const layer = Fn(() => {
      const cl = vec4(0).toVar();
      If(cover.add(high).greaterThan(0.01), () => {
        if (mode === 'layers') {
          const th = hit(dir, float(HIGH_BASE));
          const ph = at(dir, th).add(carry.mul(0.55));
          // bands stretched along the wind's line
          const fh = texture(map, vec2(ph.x.div(TILE_HIGH * 2.2), ph.y.div(TILE_HIGH))).b;
          const dh = smoothstep(float(1).sub(high), float(1.25).sub(high), fh).mul(0.5).mul(above).mul(shown);
          const aerH = float(1).sub(exp(th.div(90000).negate()));
          const colH = mix(mix(sky.mul(1.08), litCol, forward.mul(0.5).add(0.25)), sky, aerH.mul(0.8));
          cl.assign(vec4(colH.mul(dh), dh));
        }
        const c = deck();
        const a = c.w.clamp(0, 1);
        // the low layer in front of the high one
        cl.assign(vec4(c.xyz.mul(a).add(cl.xyz.mul(float(1).sub(a))), a.add(cl.w.mul(float(1).sub(a)))));
      });
      return cl;
    });
    const cl = layer() as unknown as Node<'vec4'>;
    return behind.mul(float(1).sub(cl.w)).add(cl.xyz) as unknown as V3;
  };

  return {
    over,
    update(a, b, w, wind, dtS) {
      const wa = CLOUD_WEATHER[STOP_IDS[a] ?? 'golden'];
      const wb = CLOUD_WEATHER[STOP_IDS[b] ?? 'golden'];
      const x = blendWeather(wa, wb, w);
      wA.value.set(coverOf(x.cover), x.sheet, x.soft, x.opacity);
      wB.value.set(x.base, x.thick, mode === 'layers' ? x.high : 0, 0);
      // aloft: three times the ground's wind, never under MIN_ALOFT, from the same side
      let [vx, vy] = wind.map((v) => v * 3) as [number, number];
      const s = Math.hypot(vx, vy);
      if (s < MIN_ALOFT) {
        const k = s > 1e-6 ? MIN_ALOFT / s : 0;
        [vx, vy] = s > 1e-6 ? [vx * k, vy * k] : [0, -MIN_ALOFT];
      }
      // the field is read at p + carry: moving with the wind means carry runs against it (three.js z = -north)
      carry.value.x -= vx * dtS;
      carry.value.y += vy * dtS;
      // the detail also slides sideways, slowly: shapes change as they go
      evolve.value.x += vy * 0.25 * dtS;
      evolve.value.y += vx * 0.25 * dtS;
      if (readyAt) fade = Math.min(1, fade + dtS);
      shown.value = fade;
    },
    ready() {
      readyAt = true;
    },
  };
}
