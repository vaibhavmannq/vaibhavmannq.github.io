import {
  abs,
  attribute,
  cameraPosition,
  dot,
  float,
  max,
  mix,
  normalize,
  positionWorld,
  smoothstep,
  step,
  texture,
  time,
  uv,
  vec2,
  vec3,
  vertexStage,
} from 'three/tsl';
import {
  DataTexture,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicNodeMaterial,
  NoColorSpace,
  type Node,
  PlaneGeometry,
  RepeatWrapping,
  RGBAFormat,
  UnsignedByteType,
} from 'three/webgpu';
import { windVector } from '../journey/hours';
import { STOP_IDS } from '../journey/types';
import { mulberry32 } from '../shared/random';
import type { LightUniforms } from './light';
import type { WorldPart } from './part';
import { blendWeather, CLOUD_WEATHER } from './skyClouds';

type V3 = Node<'vec3'>;
type F = Node<'float'>;

/** The atlas (tools/world/cloud_cards.py): 8 × 6 cells of 256² (42 clouds from four CC0 skies, s33), R a cloud's share, G its brightness. */
export const CARD_ATLAS_W = 2048;
export const CARD_ATLAS_H = 1536;
const CELL = 256;

/**
 * Each card's quad is cropped to the part of its cell that holds visible cloud (Task 16a, s33): only 36 % of a card's
 * rectangle holds cloud, and the field cards cover 4–7.6 screens of pixels at most stops. A tight crop keeps ~73 % of
 * the area with the same four vertices. (A grid of small quads with the empty ones collapsed kept 61 % but multiplied
 * the vertices ×120, and their sky reads cost more than the pixels saved: 3.3 vs 1.3 ms at low, s33.)
 */
const KEEP_SHARE = 0.08;

/**
 * The visible part of every card, pure: [u0, u1, v0, v1] on the card (u across, v up from its base), where its cloud's
 * share is over KEEP_SHARE (alpha ≈ 0.02), with 2 px to spare for filtering. `data` is the atlas, RGBA, rows top first.
 */
export function cardCrops(data: Uint8Array, width: number, meta: CardMeta): [number, number, number, number][] {
  return meta.cards.map((card) => {
    const pw = Math.round(card.w * CELL);
    const ph = Math.round(card.h * CELL);
    const x0 = (card.cell % meta.cols) * CELL + (CELL - pw) / 2;
    const yb = Math.floor(card.cell / meta.cols) * CELL + CELL - 2;
    const limit = KEEP_SHARE * 255;
    let ua = pw;
    let ub = -1;
    let va = ph;
    let vb = -1;
    for (let j = 0; j < ph; j++)
      for (let i = 0; i < pw; i++)
        if ((data[((yb - j) * width + Math.floor(x0 + i)) * 4] as number) > limit) {
          ua = Math.min(ua, i);
          ub = Math.max(ub, i);
          va = Math.min(va, j);
          vb = Math.max(vb, j);
        }
    if (ub < 0) return [0, 1, 0, 1];
    return [
      Math.max(0, (ua - 2) / pw),
      Math.min(1, (ub + 3) / pw),
      Math.max(0, (va - 2) / ph),
      Math.min(1, (vb + 3) / ph),
    ];
  });
}

export interface CardMeta {
  cols: number;
  rows: number;
  cards: { cell: number; w: number; h: number; lit: number }[];
}

/** How many cards share the sky; each hour shows a share of them (its cover). */
const COUNT = 640;
/** Big cards on a far ring, the horizon's cloud banks. */
const BANKS = 72;
/**
 * Golden's bank across the sun (s35, Task 17; the Golden render: one dense dark-violet bank low across the sun, the sun
 * peeking under it, gold-white edges): big cards on the far ring toward the sun, a band ~4–7° up so the 3.6° sun shows
 * under its lower edge. Out only by the hour's Golden weight (HourPreset.grade); `?sunbank=0` for the A/B.
 */
const SUN_BANK = 12;
const SUN_BANK_ON =
  (typeof location === 'undefined' ? '' : (new URLSearchParams(location.search).get('sunbank') ?? '')) !== '0';
const TOTAL = COUNT + BANKS + SUN_BANK;
/** Cards live in a square this wide around the eye and wrap as the wind carries them (m). */
const BOX = 72_000;
/** Drawn no further than this (the camera's far plane is 14 km), shrunk toward the eye to keep their size on screen. */
const DRAW_MAX = 11_000;
/** The wind aloft never under this, m/s: 24 m/s at 2 km reads as motion while the visitor rests (owner: "alive"). */
const MIN_ALOFT = 24;

/** The warm low-sun light on the cards (Task 16b, s33; picked by eye at Sunset against the render). */
const CW = 1.4;
/** Golden's bright cloud: how much a low sun lifts the lit side of clouds near it (s34). */
const CG = (() => {
  const v = Number.parseFloat(
    typeof location === 'undefined' ? '' : (new URLSearchParams(location.search).get('cg') ?? ''),
  );
  return Number.isFinite(v) ? v : 0.7;
})();
/** Golden's violet bank: how far low clouds' shaded sides turn violet under a sun within ~5° (s34). */
const VB = (() => {
  const v = Number.parseFloat(
    typeof location === 'undefined' ? '' : (new URLSearchParams(location.search).get('vb') ?? ''),
  );
  return Number.isFinite(v) ? v : 1;
})();

/** An empty atlas, filled later from cards.png (no shader rebuild when the pixels arrive). */
export function cardAtlasTexture(): DataTexture {
  const t = new DataTexture(
    new Uint8Array(CARD_ATLAS_W * CARD_ATLAS_H * 4),
    CARD_ATLAS_W,
    CARD_ATLAS_H,
    RGBAFormat,
    UnsignedByteType,
  );
  t.colorSpace = NoColorSpace;
  t.magFilter = LinearFilter;
  t.minFilter = LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

/** The cloud map's size (tools/world/cloud_map.py); only its fine detail (G) is read now, to change the cards' edges. */
export const CLOUD_MAP_N = 512;

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

export interface CloudCards extends WorldPart {
  /** The atlas has its pixels: fade the cards in. */
  ready(meta: CardMeta): void;
}

/**
 * Task 12c option `cards` (s32): real cumulus cut from daylight sky photos (cloud_cards.py), as cards standing in the
 * world 4–26 km out, 1.3–2.6 km up. They turn to face the eye about the vertical, drift with the wind aloft, wrap
 * round the eye, and are relit by the hour: their own brightness (G) blends the sky overhead's colour (the shade) into
 * the glow's (the light); toward the key they go backlit (dark cores, bright thin edges); far ones fade into the sky.
 * Sorted far to near each frame so their overlaps blend right. Above ~35° they fade (seen from beneath, a card is a
 * line).
 */
export function createCloudCards(
  u: LightUniforms,
  atlas: DataTexture,
  colorAt: (dir: V3) => V3,
  /** The cloud map (cloud_map.py): its fine detail (G) slowly eats each card's thin edges, so clouds change shape. */
  noise: DataTexture,
  /** Lowest elevation a card is drawn at, radians: `band` keeps the photo's own clouds down there (and the far cards,
   * hundreds deep, would only stack on each other), so its cards start a little above them. */
  minElev = 0,
): CloudCards {
  const rand = mulberry32(4242);
  // clouds come in fields (s32, owner: "clouds must be dense"): cards gathered round cluster centres, each cluster's
  // cards near one height, a few big masses among many small ones; the gaps between fields keep the sky readable
  const CLUSTERS = Math.round(COUNT / 7);
  const centres = Array.from({ length: CLUSTERS }, () => ({
    x: (rand() - 0.5) * BOX,
    z: (rand() - 0.5) * BOX,
    y: 1200 + rand() * 1500,
    spread: 1500 + rand() * 3500,
    rank: rand(),
  }));
  const base = Array.from({ length: COUNT }, (_, i) => {
    const c = centres[i % CLUSTERS] as (typeof centres)[number];
    const ang = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * c.spread;
    return {
      x: c.x + Math.cos(ang) * r,
      z: c.z + Math.sin(ang) * r,
      y: c.y + (rand() - 0.5) * 300,
      size: 1200 + rand() ** 2 * 6000,
      // a cluster comes out as a whole as the cover grows, its cards a little apart
      rank: Math.min(0.999, c.rank * 0.85 + rand() * 0.15),
      card: Math.floor(rand() * 1000),
      seed: rand(),
      bank: null as null | { ang: number; r: number },
      sunBank: null as null | { off: number; el: number },
    };
  });
  // banks along the horizon (s32: with the photo's clouds gone, Dusk's and First light's horizons were empty): big
  // cards on a ring 35-60 km out, low, turning slowly with the wind aloft; real skies are densest down there
  for (let i = 0; i < BANKS; i++)
    base.push({
      x: 0,
      z: 0,
      y: 1100 + rand() * 1200,
      size: 4000 + rand() * 8000,
      // most banks come out even at a light cover: the horizon is where cloud piles up in view
      rank: rand() * 0.55,
      card: Math.floor(rand() * 1000),
      seed: rand(),
      bank: { ang: rand() * Math.PI * 2, r: 35_000 + rand() * 25_000 },
      sunBank: null,
    });
  // Golden's bank across the sun: overlapping cards from ~14° left of the sun to ~14° right, their feet ~4.2–4.8° up
  for (let i = 0; i < SUN_BANK; i++)
    base.push({
      x: 0,
      z: 0,
      y: 0,
      size: 10_000 + rand() * 6000,
      rank: 0,
      card: Math.floor(rand() * 1000),
      seed: rand(),
      bank: null,
      sunBank: {
        off: ((i - (SUN_BANK - 1) / 2) / ((SUN_BANK - 1) / 2)) * 0.24 + (rand() - 0.5) * 0.05,
        el: 4.1 + rand() * 0.5,
      },
    });
  let spin = 0;
  let meta: CardMeta | null = null;
  let shown = 0;
  let carryX = 0;
  let carryZ = 0;

  const quad = new PlaneGeometry(1, 1);
  quad.translate(0.5, 0.5, 0);
  const geo = new InstancedBufferGeometry();
  geo.index = quad.index;
  geo.setAttribute('position', quad.getAttribute('position'));
  geo.setAttribute('uv', quad.getAttribute('uv'));
  let crops: [number, number, number, number][] = [];
  const iCenter = new InstancedBufferAttribute(new Float32Array(TOTAL * 3), 3);
  const iSize = new InstancedBufferAttribute(new Float32Array(TOTAL * 2), 2);
  // atlas x, y of the cloud's bottom-left (px), its width and height (px)
  const iRect = new InstancedBufferAttribute(new Float32Array(TOTAL * 4), 4);
  // mirror (±1), alpha, aerial fade (from the true distance: drawn ones are pulled in to DRAW_MAX)
  // … and the card's seed (w)
  const iInfo = new InstancedBufferAttribute(new Float32Array(TOTAL * 4), 4);
  // the crop on the card as drawn (mirrored ones flipped): u from, u to, v from, v to
  const iCrop = new InstancedBufferAttribute(new Float32Array(TOTAL * 4), 4);
  for (const a of [iCenter, iSize, iRect, iInfo, iCrop]) a.setUsage(35048); // DynamicDrawUsage
  geo.setAttribute('iCenter', iCenter);
  geo.setAttribute('iSize', iSize);
  geo.setAttribute('iRect', iRect);
  geo.setAttribute('iInfo', iInfo);
  geo.setAttribute('iCrop', iCrop);
  geo.instanceCount = 0;

  const center = attribute('iCenter', 'vec3') as unknown as V3;
  const size = attribute('iSize', 'vec2');
  const rect = attribute('iRect', 'vec4');
  const info = attribute('iInfo', 'vec4');
  const crop = attribute('iCrop', 'vec4');
  // where on the card (as drawn) this corner of the cropped quad lies
  const corner = mix(crop.xz, crop.yw, uv());
  const toEye = vec3(cameraPosition.x.sub(center.x), 0, cameraPosition.z.sub(center.z));
  const fwd = normalize(toEye.add(vec3(0.0001, 0, 0)));
  const right = vec3(fwd.z, 0, fwd.x.negate());
  const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, fog: false, side: DoubleSide });
  material.name = 'cloudCards.material';
  material.positionNode = center.add(right.mul(corner.x.sub(0.5).mul(size.x))).add(vec3(0, corner.y.mul(size.y), 0));

  // the atlas: rows top-first (no flip), so v grows downward in the image
  const ux = mix(corner.x, float(1).sub(corner.x), info.x.lessThan(0).select(float(1), float(0)));
  const at = vec2(rect.x.add(ux.mul(rect.z)).div(CARD_ATLAS_W), rect.y.sub(corner.y.mul(rect.w)).div(CARD_ATLAS_H));
  const s = texture(atlas, at);
  // alive (owner, s32): drifting noise eats the thin parts, slowly, a different place for each card, so its edges boil
  // and its shape changes over a minute; the core stays
  const seed = info.w;
  const boil = texture(
    noise,
    corner
      .mul(vec2(1.7, 1.1))
      .add(vec2(seed.mul(7.3), seed.mul(3.1)))
      .add(vec2(time.mul(0.012), time.mul(0.005))),
  ).g;
  const a = smoothstep(0.04, 0.55, s.r.sub(float(1).sub(boil).mul(0.3).mul(float(1).sub(s.r))));
  const g = s.g;
  const dir = normalize(positionWorld.sub(cameraPosition));
  const key = u.keyDir as unknown as V3;
  // the sky's colours change slowly across a card: read at its four corners, not per pixel (s32: six sky reads a pixel
  // cost ~1 ms at low)
  const sky = vertexStage(colorAt(dir)) as unknown as V3;
  const glow = colorAt(normalize(vec3(key.x, key.y.max(0.07), key.z)));
  const zenith = colorAt(normalize(vec3(0.02, 1, 0.01)));
  const lum = (c: V3): F => dot(c, vec3(0.2126, 0.7152, 0.0722)).max(1e-4);
  const glowLum = lum(glow);
  const litCol = vertexStage(
    glow.div(glowLum).mul(
      glowLum
        .mul(0.7)
        .min(2.2)
        .min(
          lum(zenith)
            .max(lum(colorAt(dir)))
            .mul(2.5),
        ),
    ),
  ) as unknown as V3;
  // the shaded side: the sky overhead's hue, always darker than the sky behind (toward the sun the sky is bright and a
  // cloud's core reads as a dark shape against it, as in every sunset photo)
  const shadeCol = vertexStage(
    mix(zenith, colorAt(dir), 0.3)
      .mul(
        lum(colorAt(dir))
          .div(lum(mix(zenith, colorAt(dir), 0.3)))
          .min(1.2),
      )
      .mul(0.5),
  ) as unknown as V3;
  const cosK = dot(dir, key);
  const backlit = smoothstep(0.25, 0.9, cosK);
  const keyVis = smoothstep(-0.12, 0.08, key.y).mul(0.65).add(0.35);
  // The Witcher 3's way (s32, owner's reference): the card is lit through a normal from its own height (B), so our sun
  // or moon lights it from the side it really is on, in every view and ride. Two more reads of the height beside this pixel.
  const du = 2 / CARD_ATLAS_W;
  const dv = 2 / CARD_ATLAS_H;
  const hAt = (ox: number, oy: number): F => texture(atlas, at.add(vec2(ox, oy))).b;
  const mirror = info.x.lessThan(0).select(float(-1), float(1));
  // forward differences from the read already made (two reads, not four: s32, First light's stacked cards)
  const dhx = hAt(du, 0).sub(s.b).mul(2).mul(mirror);
  const dhy = hAt(0, -dv).sub(s.b).mul(2); // up the card is up the image, where v falls
  const bump = 3.5;
  const nl = normalize(vec3(dhx.mul(-bump), dhy.mul(-bump), 1));
  const normal = normalize(
    right
      .mul(nl.x)
      .add(vec3(0, nl.y, 0))
      .add(fwd.mul(nl.z)),
  );
  // half-Lambert (light wraps round a cloud), sharpened a little; the photo's own lit bumps (G) add fine detail
  const wrap = dot(normal, key).mul(0.5).add(0.5).pow(1.6);
  const light = wrap.mul(g.mul(0.5).add(0.6)).mul(keyVis).min(1);
  // toward the key: light through the thin parts (low height) warms them; the silver edge where the cloud thins
  const through = litCol.mul(backlit).mul(float(1).sub(s.b)).mul(a).mul(0.2);
  const edge = s.r.mul(float(1).sub(s.r)).mul(4);
  const silver = max(cosK, 0).pow(10).mul(0.5).mul(edge);
  // Task 16b (s33; the Sunset render; reference book §light): under a low sun a cloud is lit by the sun's own light,
  // redder and more saturated than the sky round it, and its base, seen from below, glows (the light comes in under
  // it). Only from the sun (the moon's hours keep their grey clouds), strongest as the sun nears the horizon.
  const isSun = float(1).sub(smoothstep(0.0, 0.001, u.moonStrength as unknown as F));
  const lowSun = smoothstep(0.4, 0.03, key.y)
    .mul(smoothstep(-0.1, -0.01, key.y))
    .mul(isSun)
    .mul(CW);
  const sunHue = (u.keyColor as unknown as V3).div(lum(u.keyColor as unknown as V3));
  const warmLit = mix(litCol, sunHue.mul(lum(litCol)), lowSun.mul(0.65));
  const cloudBase = smoothstep(0.55, 0.0, corner.y).mul(smoothstep(0.85, 0.2, s.b));
  const under = warmLit.mul(cloudBase).mul(lowSun).mul(max(cosK, 0).mul(0.6).add(0.4)).mul(0.55);
  // Golden's violet bank (s34; the Golden and Sunset renders, reference book §light): under a sun within ~5° of the
  // horizon the low clouds' shaded sides are lit only by the high sky through the long path, its red and blue left:
  // violet, darker than the sky behind them. Not at Sunrise's 12° sun, not under the moon. `?vb=` while tuning.
  const bankOn = smoothstep(0.12, 0.05, key.y)
    .mul(smoothstep(-0.02, 0.0, key.y))
    .mul(isSun);
  const lowCloud = smoothstep(0.3, 0.03, dir.y);
  const violetShade = vec3(0.141, 0.069, 0.325)
    .div(0.2126 * 0.141 + 0.7152 * 0.069 + 0.0722 * 0.325)
    .mul(lum(shadeCol).mul(0.62));
  const shadeBanked = mix(shadeCol, violetShade, bankOn.mul(lowCloud).mul(VB));
  // Golden's bright cloud (s34, Task 17b; the Golden render): under a low sun the clouds near it are lit gold-white, their
  // edges silver, brighter than the sky behind; ours stayed beige. Their lit side lifts toward the sun, by `?cg=`.
  // Golden's only (a sun above ~2°): at Sunset it washed the violet clouds pale
  const golden = smoothstep(0.03, 0.055, key.y).mul(bankOn); // Golden only (not Sunset's 1° sun, not Sunrise's 12°)
  const nearSun = smoothstep(0.55, 0.95, cosK).mul(golden);
  // the silver edge only on the side a card turns to the sun (s35: on every edge it outlined each card like a sticker)
  const sunSide = mix(float(1), smoothstep(0.35, 0.8, light), golden);
  const litNear = warmLit.mul(float(1).add(nearSun.mul(CG)));
  // Golden's sun bank (±2 in info.x): the render's bank is dark violet against the gold, not the bright sky's shade
  const isSunBank = step(1.5, abs(info.x));
  const shadeSun = mix(shadeBanked, violetShade, isSunBank);
  const col = mix(
    mix(shadeSun, litNear, light)
      .add(litNear.mul(silver.mul(float(1).add(nearSun.mul(CG * 2))).mul(sunSide)))
      .add(through.mul(float(1).sub(isSunBank.mul(0.6))))
      .add(under),
    sky,
    info.z,
  );
  material.colorNode = col;
  material.opacityNode = a.mul(info.y).mul(smoothstep(0.0, 0.02, dir.y));

  const mesh = new Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 0.5; // after the sky and the aurora (100 km up, behind any cloud), before nearer see-through things

  const order: number[] = Array.from({ length: TOTAL }, (_, i) => i);
  const dist2 = new Float32Array(TOTAL);
  /** which drawn instance is a bank (bench.ts `__cloudPx`, s33) */
  const bankOf = new Uint8Array(TOTAL);
  mesh.userData.bank = bankOf;
  /** the share of each drawn instance's quad that is drawn (bench.ts `__cloudPx`) */
  const keptOf = new Float32Array(TOTAL);
  mesh.userData.kept = keptOf;

  return {
    object: mesh,
    ready(m) {
      meta = m;
      crops = cardCrops(atlas.image.data as Uint8Array, CARD_ATLAS_W, m);
    },
    update(f) {
      if (!meta || meta.cards.length === 0) return;
      shown = Math.min(1, shown + f.dtS);
      const [cx, cy, cz] = f.pose.position;
      const w = blendWeather(
        CLOUD_WEATHER[STOP_IDS[f.state.a] ?? 'golden'],
        CLOUD_WEATHER[STOP_IDS[f.state.b] ?? 'golden'],
        u.skyWeight.value,
      );
      // the share of the cards out: Night and Midnight a few, the overcast hours nearly all
      // capped: past 0.85 the cards stack deep and cost (First light, s32) without looking denser
      const share = Math.min(0.85, w.cover * 1.8);
      const grow = 0.9 + w.cover * 0.9;
      let [vx, vy] = windVector(f.hour.world).map((v) => v * 3) as [number, number];
      const sp = Math.hypot(vx, vy);
      if (sp < MIN_ALOFT) {
        const k = sp > 1e-6 ? MIN_ALOFT / sp : 0;
        [vx, vy] = sp > 1e-6 ? [vx * k, vy * k] : [0, -MIN_ALOFT];
      }
      carryX += vx * f.dtS;
      carryZ -= vy * f.dtS;
      // the banks turn about the eye as the wind would carry them past at their distance
      spin += (Math.hypot(vx, vy) / 45_000) * f.dtS;
      const pos = new Float32Array(TOTAL * 3);
      const vis = new Float32Array(TOTAL);
      for (let i = 0; i < TOTAL; i++) {
        const b = base[i] as (typeof base)[number];
        const wrap = (v: number) => ((((v + BOX / 2) % BOX) + BOX) % BOX) - BOX / 2;
        // Golden's sun bank: on a 30 km ring toward the sun (three.js x, z), drifting a little with the banks
        const sunAng = b.sunBank ? Math.atan2(u.keyDir.value.z, u.keyDir.value.x) + b.sunBank.off + spin * 0.3 : 0;
        const x = b.sunBank
          ? cx + Math.cos(sunAng) * 30_000
          : b.bank
            ? cx + Math.cos(b.bank.ang + spin) * b.bank.r
            : cx + wrap(b.x + carryX - cx);
        const z = b.sunBank
          ? cz + Math.sin(sunAng) * 30_000
          : b.bank
            ? cz + Math.sin(b.bank.ang + spin) * b.bank.r
            : cz + wrap(b.z + carryZ - cz);
        const y = b.sunBank ? cy + Math.tan((b.sunBank.el * Math.PI) / 180) * 30_000 : b.y;
        const dx = x - cx;
        const dz = z - cz;
        const flat = Math.hypot(dx, dz);
        const elev = Math.atan2(y - cy, flat);
        const fade = b.sunBank
          ? SUN_BANK_ON
            ? f.hour.grade
            : 0
          : (b.bank ? 1 : smooth(2500, 4500, flat) * smooth(BOX / 2, BOX / 2 - 5000, flat)) *
            smooth(0.75, 0.5, elev) *
            smooth(minElev, minElev + 0.03, elev) *
            smooth(b.rank - 0.08, b.rank, share);
        pos[i * 3] = x;
        pos[i * 3 + 1] = y;
        pos[i * 3 + 2] = z;
        vis[i] = fade * shown * w.opacity;
        dist2[i] = dx * dx + dz * dz + (y - cy) * (y - cy);
      }
      // far to near: overlaps blend right
      order.sort((p, q) => (dist2[q] as number) - (dist2[p] as number));
      let n = 0;
      for (const i of order) {
        if ((vis[i] as number) <= 0.001) continue;
        const b = base[i] as (typeof base)[number];
        const card = meta.cards[b.card % meta.cards.length] as CardMeta['cards'][number];
        const x = pos[i * 3] as number;
        const y = pos[i * 3 + 1] as number;
        const z = pos[i * 3 + 2] as number;
        const d = Math.sqrt(dist2[i] as number);
        const k = d > DRAW_MAX ? DRAW_MAX / d : 1;
        const worldW = b.size * grow * k;
        // far banks are seen nearly edge-on: flattened to a quarter, as distance flattens real clouds
        const worldH = ((worldW * card.h) / Math.max(card.w, 1e-3)) * (b.bank ? 0.28 : b.sunBank ? 0.32 : 1);
        const cr = crops[b.card % meta.cards.length];
        const [u0, u1, v0, v1] = cr ?? [0, 1, 0, 1];
        // as drawn: mirrored ones flipped
        const [du0, du1] = b.rank > 0.5 ? [u0, u1] : [1 - u1, 1 - u0];
        let px = cx + (x - cx) * k;
        let py = cy + (y - cy) * k;
        let pz = cz + (z - cz) * k;
        if (b.sunBank) {
          // Golden's sun bank cropped like every card (s35, the phone: uncropped, its transparent margins cost 1–2 fps on
          // I → II), the card moved so its visible cloud keeps the place the whole card had: centred across, foot down
          const fx = cx - px;
          const fz = cz - pz;
          const fl = Math.hypot(fx, fz) || 1;
          const [rx, rz] = [fz / fl, -fx / fl]; // the shader's `right`
          const across = -((du0 + du1) / 2 - 0.5) * worldW;
          px += rx * across;
          pz += rz * across;
          py -= v0 * worldH;
        }
        iCenter.setXYZ(n, px, py, pz);
        iSize.setXY(n, worldW, worldH);
        const col = card.cell % meta.cols;
        const row = Math.floor(card.cell / meta.cols);
        const pw = card.w * CELL;
        const ph = card.h * CELL;
        iRect.setXYZW(n, col * CELL + (CELL - pw) / 2, row * CELL + CELL - 2, pw, ph);
        // mirrored at random for variety: the normal from the height lights it from the true side either way
        // cropped to its visible cloud (16a; the phone: +1.7 fps, a third fewer slow frames on VI → VII, R244)
        iCrop.setXYZW(n, du0, du1, v0, v1);
        keptOf[n] = (u1 - u0) * (v1 - v0);
        bankOf[n] = b.bank || b.sunBank ? 1 : 0;
        iInfo.setXYZW(
          n,
          (b.rank > 0.5 ? 1 : -1) * (b.sunBank ? 2 : 1), // ±2: Golden's sun bank (its own shade)
          vis[i] as number,
          (b.bank ? 0.3 : b.sunBank ? 0.12 : 0.6) * (1 - Math.exp(-d / 30000)),
          b.seed,
        );
        n++;
      }
      geo.instanceCount = n;
      for (const attr of [iCenter, iSize, iRect, iInfo, iCrop]) {
        attr.clearUpdateRanges();
        attr.addUpdateRange(0, n * attr.itemSize);
        attr.needsUpdate = true;
      }
    },
    setTier() {},
    dispose() {
      geo.dispose();
      quad.dispose();
      material.dispose();
    },
  };
}

function smooth(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}
