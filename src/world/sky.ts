import {
  cameraPosition,
  cos,
  dot,
  equirectUV,
  float,
  floor,
  fract,
  length,
  max,
  min,
  mix,
  normalize,
  positionWorld,
  sin,
  smoothstep,
  step,
  texture,
  vec2,
  vec3,
} from 'three/tsl';
import { BackSide, Mesh, MeshBasicNodeMaterial, type Node, SphereGeometry, type Texture } from 'three/webgpu';
import type { SkyStore } from '../assets/skies';
import type { LightUniforms } from './light';
import type { WorldPart } from './part';

type V3 = Node<'vec3'>;
type F = Node<'float'>;

/** The sky files store e = (x / (1 + x))^(1/2.2) (tools/world/prep_sky.py); this gives x back. */
const decode = (e: V3): V3 => {
  const p = e.pow(2.2);
  return p.div(float(1).sub(p).max(0.03));
};

/** A hash of a 3D cell: a repeatable random number per cell. */
const hash3 = (c: V3): F => fract(sin(dot(c, vec3(127.1, 311.7, 74.7))).mul(43758.5453));

/** Where the painted horizon rows are read: inside the bottom HORIZON_ROWS (6) rows of a 1024-row photo. */
const HORIZON_V = 2.5 / 1024;

export interface Sky extends WorldPart {
  /** The sky colour seen along a direction (three.js axes), for reflections in water and wet sand. */
  colorAt(dir: V3): V3;
  /** The sky's soft colour at the horizon in the compass direction of `dir`: what distant things fade into. */
  horizonAt(dir: V3): V3;
}

export function createSky(u: LightUniforms, skies: SkyStore, first: Texture): Sky {
  const texA = texture(first);
  const texB = texture(first);

  const colorAt = (dir: V3, row?: number): V3 => {
    const st = row === undefined ? equirectUV(dir) : vec2(equirectUV(dir).x, row);
    return mix(decode(texA.sample(st).rgb), decode(texB.sample(st).rgb), u.skyWeight)
      .mul(u.skyGain)
      .mul(u.skyTint);
  };

  // Far things fade into the sky's soft horizon colour in their compass direction (horizonAt, used as the scene's fog),
  // and the sky below the horizon is that same colour: the far sea and land meet the sky with no line, whatever the
  // hour (M0 look note). The soft colours are painted into each photo's bottom rows when it is decoded (skyHorizon.ts).
  const horizonAt = (d: V3): V3 => colorAt(normalize(vec3(d.x, 0, d.z)), HORIZON_V);
  const dir = normalize(positionWorld.sub(cameraPosition));
  let col = mix(colorAt(dir), horizonAt(dir), smoothstep(0.0, -0.025, dir.y));

  // The sun's disc, only while the key light is the sun (at night the key is the moon, drawn below).
  const isSun = float(1).sub(step(0.001, u.moonStrength));
  const sunDisc = smoothstep(0.999984, 0.999994, dot(dir, u.keyDir)).mul(40.0).mul(min(u.keyStrength, 1)).mul(isSun);
  col = col.add(u.keyColor.mul(sunDisc));

  // The moon (owner night-sky-and-moon 3, 4, 5, 8): a small sharp disc, lit as a crescent by its phase, the dark part
  // faintly grey (earthshine), a soft halo that lights the sky and cloud beside it. Tested on squared angles
  // (light.ts moonCover): WGSL's cos is only good to ~5e-4, which erased the disc before (s07 bug).
  const radius = u.moonSize.mul(Math.PI / 360);
  const r2a = radius.mul(0.95).pow(2);
  const r2b = radius.mul(1.05).pow(2);
  const toMoon = float(1).sub(dot(dir, u.moonDir)).mul(2);
  const disc = float(1).sub(smoothstep(r2a, r2b, toMoon));
  const moonDark = float(1).sub(smoothstep(r2a, r2b, float(1).sub(dot(dir, u.moonShadowDir)).mul(2)));
  const moonLitPart = disc.mul(float(1).sub(moonDark));
  const earthshine = disc.mul(moonDark).mul(0.035);
  const halo = toMoon.max(0).sqrt().div(radius.mul(4)).negate().exp().mul(u.moonLit.mul(0.7).add(0.3)).mul(0.18);
  col = col.add(vec3(1.0, 0.98, 0.94).mul(moonLitPart.add(earthshine)).mul(u.moonStrength).mul(0.1));
  col = col.add(vec3(0.75, 0.82, 1.0).mul(halo).mul(u.moonStrength).mul(0.1));

  // Stars: one point per random cell, high in the sky and only where the sky is dark (coast.py's star_mask idea).
  const p = dir.mul(260.0);
  const cell = floor(p);
  const centre = vec3(hash3(cell), hash3(cell.add(17.0)), hash3(cell.add(31.0)))
    .sub(0.5)
    .mul(0.6);
  const point = smoothstep(0.09, 0.0, length(fract(p).sub(0.5).sub(centre)));
  const lit = step(float(1).sub(u.stars.mul(0.012)), hash3(cell.add(5.0)));
  const high = smoothstep(0.04, 0.3, dir.y);
  const dark = smoothstep(0.35, 0.08, dot(col, vec3(0.2126, 0.7152, 0.0722)));
  col = col.add(vec3(0.85, 0.9, 1.0).mul(point.mul(lit).mul(high).mul(dark).mul(max(u.stars, 0).min(1).mul(3.0))));

  const material = new MeshBasicNodeMaterial({ side: BackSide, depthWrite: false, fog: false });
  material.colorNode = col;
  const mesh = new Mesh(new SphereGeometry(12000, 64, 32), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;

  return {
    object: mesh,
    colorAt,
    horizonAt,
    update(f) {
      skies.update(f.state);
      texA.value = skies.get(f.state.a);
      texB.value = skies.get(f.state.b);
      mesh.position.set(...f.pose.position);
    },
    setTier() {},
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}
