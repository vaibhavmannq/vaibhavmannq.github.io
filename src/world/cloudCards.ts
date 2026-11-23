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
const COUNT = 420;
/** Cards live in a square this wide around the eye and wrap as the wind carries them (m). */
const BOX = 72_000;
/** Drawn no further than this (the camera's far plane is 14 km), shrunk toward the eye to keep their size on screen. */
const DRAW_MAX = 11_000;
const MIN_ALOFT = 8;

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
export function createCloudCards(u: LightUniforms, atlas: DataTexture, colorAt: (dir: V3) => V3): CloudCards {
  const rand = mulberry32(4242);
  const base = Array.from({ length: COUNT }, () => ({
    x: (rand() - 0.5) * BOX,
    z: (rand() - 0.5) * BOX,
    y: 1300 + rand() * 1300,
    // a few big masses among many small ones
    size: 900 + rand() ** 2.2 * 5200,
    rank: rand(),
    card: Math.floor(rand() * 1000),
  }));
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
  const iCenter = new InstancedBufferAttribute(new Float32Array(COUNT * 3), 3);
  const iSize = new InstancedBufferAttribute(new Float32Array(COUNT * 2), 2);
  // atlas x, y of the cloud's bottom-left (px), its width and height (px)
  const iRect = new InstancedBufferAttribute(new Float32Array(COUNT * 4), 4);
  // mirror (±1), alpha, aerial fade (from the true distance: drawn ones are pulled in to DRAW_MAX)
  const iInfo = new InstancedBufferAttribute(new Float32Array(COUNT * 3), 3);
  for (const a of [iCenter, iSize, iRect, iInfo]) a.setUsage(35048); // DynamicDrawUsage
  geo.setAttribute('iCenter', iCenter);
  geo.setAttribute('iSize', iSize);
  geo.setAttribute('iRect', iRect);
  geo.setAttribute('iInfo', iInfo);
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
  const a = smoothstep(0.04, 0.55, s.r);
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
  // toward the key: the photo's front light is wrong; cores go dark, thin parts glow
  const light = mix(g.mul(keyVis), float(1).sub(a).mul(0.7), backlit.mul(0.45));
  // the silver edge: where the cloud thins (mid alpha), toward the key; light through thin cloud warms the cores a little
  const edge = s.r.mul(float(1).sub(s.r)).mul(4);
  const silver = max(cosK, 0).pow(8).mul(0.9).mul(edge);
  const through = litCol.mul(backlit).mul(float(1).sub(a)).mul(0.3);
  const col = mix(mix(shadeCol, litCol, light).add(litCol.mul(silver)).add(through), sky, info.z);
  material.colorNode = col;
  material.opacityNode = a.mul(info.y).mul(smoothstep(0.0, 0.02, dir.y));

  const mesh = new Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 0.5; // after the sky and the aurora (100 km up, behind any cloud), before nearer see-through things

  const order: number[] = Array.from({ length: COUNT }, (_, i) => i);
  const dist2 = new Float32Array(COUNT);

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
      const share = Math.min(1, w.cover * 1.25);
      const grow = 0.8 + w.cover * 0.8;
      let [vx, vy] = windVector(f.hour.world).map((v) => v * 3) as [number, number];
      const sp = Math.hypot(vx, vy);
      if (sp < MIN_ALOFT) {
        const k = sp > 1e-6 ? MIN_ALOFT / sp : 0;
        [vx, vy] = sp > 1e-6 ? [vx * k, vy * k] : [0, -MIN_ALOFT];
      }
      carryX += vx * f.dtS;
      carryZ -= vy * f.dtS;
      const keyX = u.keyDir.value.x;
      const keyZ = u.keyDir.value.z;
      const pos = new Float32Array(COUNT * 3);
      const vis = new Float32Array(COUNT);
      for (let i = 0; i < COUNT; i++) {
        const b = base[i] as (typeof base)[number];
        const wrap = (v: number) => ((((v + BOX / 2) % BOX) + BOX) % BOX) - BOX / 2;
        const x = cx + wrap(b.x + carryX - cx);
        const z = cz + wrap(b.z + carryZ - cz);
        const y = b.y;
        const dx = x - cx;
        const dz = z - cz;
        const flat = Math.hypot(dx, dz);
        const elev = Math.atan2(y - cy, flat);
        const fade =
          smooth(2500, 4500, flat) *
          smooth(BOX / 2, BOX / 2 - 5000, flat) *
          smooth(0.75, 0.5, elev) *
          smooth(b.rank, b.rank - 0.08, share);
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
        iSize.setXY(n, worldW, (worldW * card.h) / Math.max(card.w, 1e-3));
        const col = card.cell % meta.cols;
        const row = Math.floor(card.cell / meta.cols);
        const pw = card.w * CELL;
        const ph = card.h * CELL;
        iRect.setXYZW(n, col * CELL + (CELL - pw) / 2, row * CELL + CELL - 2, pw, ph);
        // the sun to the card's right as seen from here? Its photo was lit from `lit`'s side: mirror if they differ
        const fx = (cx - x) / Math.max(1e-3, Math.hypot(cx - x, cz - z));
        const fz = (cz - z) / Math.max(1e-3, Math.hypot(cx - x, cz - z));
        const sunRight = keyX * fz + keyZ * -fx > 0 ? 1 : -1;
        iInfo.setXYZ(n, sunRight === card.lit ? 1 : -1, vis[i] as number, (1 - Math.exp(-d / 30000)) * 0.6);
        n++;
      }
      geo.instanceCount = n;
      for (const attr of [iCenter, iSize, iRect, iInfo]) {
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
