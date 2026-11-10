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

export interface Sky extends WorldPart {
  /** The sky colour seen along a direction (three.js axes), for reflections in water and wet sand. */
  colorAt(dir: V3): V3;
}

export function createSky(u: LightUniforms, skies: SkyStore, first: Texture): Sky {
  const texA = texture(first);
  const texB = texture(first);

  const colorAt = (dir: V3): V3 => {
    const st = equirectUV(dir);
    return mix(decode(texA.sample(st).rgb), decode(texB.sample(st).rgb), u.skyWeight)
      .mul(u.skyGain)
      .mul(u.skyTint);
  };

  const dir = normalize(positionWorld.sub(cameraPosition));
  let col = colorAt(dir);

  // The sun's disc, only while the key light is the sun (at night the key is the moon, drawn below).
  const isSun = float(1).sub(step(0.001, u.moonStrength));
  const sunDisc = smoothstep(0.999984, 0.999994, dot(dir, u.keyDir)).mul(40.0).mul(min(u.keyStrength, 1)).mul(isSun);
  col = col.add(u.keyColor.mul(sunDisc));

  // The moon: a soft disc of its own angular size.
  const radius = u.moonSize.mul(Math.PI / 360);
  const moon = smoothstep(cos(radius.mul(1.15)), cos(radius.mul(0.85)), dot(dir, u.moonDir));
  col = col.add(vec3(1.0, 0.98, 0.94).mul(moon).mul(u.moonStrength).mul(0.1));

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
