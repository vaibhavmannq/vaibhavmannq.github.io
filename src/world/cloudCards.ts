import {
  attribute,
  cameraPosition,
  dot,
  float,
  max,
  mix,
  normalize,
  positionWorld,
  smoothstep,
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

/** The atlas (tools/world/cloud_cards.py): 8 × 4 cells of 256², R a cloud's share, G its brightness. */
export const CARD_ATLAS_W = 2048;
export const CARD_ATLAS_H = 1024;
const CELL = 256;

export interface CardMeta {
  cols: number;
  rows: number;
  cards: { cell: number; w: number; h: number; lit: number }[];
}

/** How many cards share the sky; each hour shows a share of them (its cover). */
const COUNT = 640;
/** Big cards on a far ring, the horizon's cloud banks. */
const BANKS = 72;
const TOTAL = COUNT + BANKS;
/** Cards live in a square this wide around the eye and wrap as the wind carries them (m). */
const BOX = 72_000;
/** Drawn no further than this (the camera's far plane is 14 km), shrunk toward the eye to keep their size on screen. */
const DRAW_MAX = 11_000;
/** The wind aloft never under this, m/s: 24 m/s at 2 km reads as motion while the visitor rests (owner: "alive"). */
const MIN_ALOFT = 24;

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
    });
  let spin = 0;
  let meta: CardMeta | null = null;
  let shown = 0;
  let carryX = 0;
  let carryZ = 0;

  const quad = new PlaneGeometry(1, 1);
  quad.translate(0, 0.5, 0); // the cloud's base on its height
  const geo = new InstancedBufferGeometry();
  geo.index = quad.index;
  geo.setAttribute('position', quad.getAttribute('position'));
  geo.setAttribute('uv', quad.getAttribute('uv'));
  const iCenter = new InstancedBufferAttribute(new Float32Array(TOTAL * 3), 3);
  const iSize = new InstancedBufferAttribute(new Float32Array(TOTAL * 2), 2);
  // atlas x, y of the cloud's bottom-left (px), its width and height (px)
  const iRect = new InstancedBufferAttribute(new Float32Array(TOTAL * 4), 4);
  // mirror (±1), alpha, aerial fade (from the true distance: drawn ones are pulled in to DRAW_MAX)
  const iInfo = new InstancedBufferAttribute(new Float32Array(TOTAL * 3), 3);
  const iSeed = new InstancedBufferAttribute(new Float32Array(TOTAL), 1);
  for (const a of [iCenter, iSize, iRect, iInfo, iSeed]) a.setUsage(35048); // DynamicDrawUsage
  geo.setAttribute('iCenter', iCenter);
  geo.setAttribute('iSize', iSize);
  geo.setAttribute('iRect', iRect);
  geo.setAttribute('iInfo', iInfo);
  geo.setAttribute('iSeed', iSeed);
  geo.instanceCount = 0;

  const center = attribute('iCenter', 'vec3') as unknown as V3;
  const size = attribute('iSize', 'vec2');
  const rect = attribute('iRect', 'vec4');
  const info = attribute('iInfo', 'vec3');
  const corner = uv();
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
  const seed = attribute('iSeed', 'float');
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
  const col = mix(mix(shadeCol, litCol, light).add(litCol.mul(silver)).add(through), sky, info.z);
  material.colorNode = col;
  material.opacityNode = a.mul(info.y).mul(smoothstep(0.0, 0.02, dir.y));

  const mesh = new Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 0.5; // after the sky and the aurora (100 km up, behind any cloud), before nearer see-through things

  const order: number[] = Array.from({ length: TOTAL }, (_, i) => i);
  const dist2 = new Float32Array(TOTAL);

  return {
    object: mesh,
    ready(m) {
      meta = m;
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
        const x = b.bank ? cx + Math.cos(b.bank.ang + spin) * b.bank.r : cx + wrap(b.x + carryX - cx);
        const z = b.bank ? cz + Math.sin(b.bank.ang + spin) * b.bank.r : cz + wrap(b.z + carryZ - cz);
        const y = b.y;
        const dx = x - cx;
        const dz = z - cz;
        const flat = Math.hypot(dx, dz);
        const elev = Math.atan2(y - cy, flat);
        const fade =
          (b.bank ? 1 : smooth(2500, 4500, flat) * smooth(BOX / 2, BOX / 2 - 5000, flat)) *
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
        iCenter.setXYZ(n, cx + (x - cx) * k, cy + (y - cy) * k, cz + (z - cz) * k);
        const worldW = b.size * grow * k;
        // far banks are seen nearly edge-on: flattened to a quarter, as distance flattens real clouds
        iSize.setXY(n, worldW, ((worldW * card.h) / Math.max(card.w, 1e-3)) * (b.bank ? 0.28 : 1));
        const col = card.cell % meta.cols;
        const row = Math.floor(card.cell / meta.cols);
        const pw = card.w * CELL;
        const ph = card.h * CELL;
        iRect.setXYZW(n, col * CELL + (CELL - pw) / 2, row * CELL + CELL - 2, pw, ph);
        // mirrored at random for variety: the normal from the height lights it from the true side either way
        iSeed.setX(n, b.seed);
        iInfo.setXYZ(n, b.rank > 0.5 ? 1 : -1, vis[i] as number, (b.bank ? 0.3 : 0.6) * (1 - Math.exp(-d / 30000)));
        n++;
      }
      geo.instanceCount = n;
      for (const attr of [iCenter, iSize, iRect, iInfo, iSeed]) {
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
