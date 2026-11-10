import {
  cameraPosition,
  cos,
  dot,
  exp,
  float,
  fwidth,
  max,
  mix,
  mx_noise_float,
  normalize,
  positionWorld,
  reflect,
  reflector,
  smoothstep,
  step,
  texture,
  time,
  uniform,
  vec2,
  vec3,
} from 'three/tsl';
import {
  DataTexture,
  DataUtils,
  Group,
  HalfFloatType,
  LinearFilter,
  Mesh,
  MeshBasicNodeMaterial,
  type Node,
  PlaneGeometry,
  RedFormat,
} from 'three/webgpu';
import type { TierSettings } from '../quality/tiers';
import type { GridMeta } from './heights';
import type { LightUniforms } from './light';
import type { WorldPart } from './part';

/** Six analytic ripples: direction x, direction z, amplitude, frequency (the slice's). */
const WAVES: [number, number, number, number][] = [
  [0.9, 0.42, 0.012, 0.6],
  [-0.35, 0.94, 0.009, 0.9],
  [0.6, -0.8, 0.006, 1.7],
  [-0.95, -0.3, 0.004, 2.6],
  [0.2, 0.98, 0.003, 4.1],
  [0.75, 0.66, 0.0025, 6.3],
];

/** The heights as a half-float texture, for the shore foam (the depth under the water). */
export function heightTexture(q: Uint16Array, m: GridMeta): DataTexture {
  const data = new Uint16Array(q.length);
  const k = (m.hi - m.lo) / 65535;
  for (let i = 0; i < q.length; i++) data[i] = DataUtils.toHalfFloat(m.lo + (q[i] as number) * k);
  const t = new DataTexture(data, m.nx, m.ny, RedFormat, HalfFloatType);
  t.minFilter = LinearFilter;
  t.magFilter = LinearFilter;
  t.needsUpdate = true;
  return t;
}

export function createSea(heights: DataTexture, meta: GridMeta, u: LightUniforms, tier: TierSettings): WorldPart {
  const reflection = reflector({ resolutionScale: tier.reflect });
  reflection.target.rotateX(-Math.PI / 2);
  const chop = uniform(1);

  const p = vec2(positionWorld.x, positionWorld.z);
  const pixel = fwidth(p).length();
  let gx: Node<'float'> = float(0);
  let gz: Node<'float'> = float(0);
  for (const [dx, dz, a, f] of WAVES) {
    const phase = p.x
      .mul(dx * f)
      .add(p.y.mul(dz * f))
      .add(time.mul(Math.sqrt(9.8 * f) * 0.6));
    // Fine ripples fade where they would alias into stripes (s02).
    const c = cos(phase)
      .mul(a * f * 0.35)
      .mul(chop)
      .mul(smoothstep(1.2, 0.35, pixel.mul(f)));
    gx = gx.add(c.mul(dx));
    gz = gz.add(c.mul(dz));
  }
  const toCam = cameraPosition.sub(positionWorld);
  const dist = toCam.length();
  const flatten = smoothstep(450.0, 25.0, dist);
  const n = normalize(vec3(gx.negate().mul(flatten), 1, gz.negate().mul(flatten)));
  const v = normalize(toCam);
  const fresnel = float(0.02).add(
    float(0.98).mul(
      float(1)
        .sub(max(dot(v, n), 0))
        .pow(5),
    ),
  );
  if (reflection.uvNode) reflection.uvNode = reflection.uvNode.add(n.xz.mul(0.12).div(dist.mul(0.08).add(1)));
  const body = u.ambSky.mul(vec3(0.05, 0.07, 0.08));
  const glint = max(dot(reflect(v.negate(), n), u.keyDir), 0)
    .pow(1400)
    .mul(u.keyColor)
    .mul(14.0);
  let col = mix(body, reflection.rgb, fresnel).add(glint);

  // Shore: depth from the heights, foam at the edge, a sheet in the swash, transparent shallows (slice).
  const x1 = meta.x0 + (meta.nx - 1) * meta.step;
  const y1 = meta.y0 + (meta.ny - 1) * meta.step;
  const hu = vec2(
    positionWorld.x.sub(meta.x0).div(x1 - meta.x0),
    positionWorld.z
      .negate()
      .sub(meta.y0)
      .div(y1 - meta.y0),
  );
  const inside = step(0, hu.x).mul(step(hu.x, 1)).mul(step(0, hu.y)).mul(step(hu.y, 1));
  const depth = mix(float(-30), texture(heights, hu).r, inside).negate();
  const lace = smoothstep(
    0.05,
    0.5,
    mx_noise_float(vec3(p.mul(1.6), time.mul(0.25)))
      .mul(0.5)
      .add(0.5),
  );
  const edge = exp(depth.sub(0.07).div(0.05).pow(2).negate());
  const sheet = smoothstep(1.0, 0.15, depth)
    .mul(smoothstep(0, 0.12, depth))
    .mul(0.45);
  const foam = max(edge, sheet)
    .mul(lace)
    .mul(smoothstep(160.0, 40.0, dist));
  col = mix(col, u.ambSky.mul(1.8).add(u.keyColor.mul(0.45)), foam.clamp(0, 1));

  const material = new MeshBasicNodeMaterial({ transparent: true });
  material.colorNode = col;
  material.opacityNode = smoothstep(0.0, 0.35, depth).mul(0.85).add(fresnel.mul(0.15)).max(foam).clamp(0, 1);
  const sea = new Mesh(new PlaneGeometry(16000, 16000, 1, 1), material);
  sea.rotation.x = -Math.PI / 2;
  sea.renderOrder = 1;
  const group = new Group();
  group.add(sea, reflection.target);

  return {
    object: group,
    update(f) {
      chop.value = 0.3 + f.hour.chop;
      // The plane follows the camera so it always reaches the horizon.
      sea.position.x = f.pose.position[0];
      sea.position.z = f.pose.position[2];
    },
    setTier(t) {
      reflection.reflector.resolutionScale = t.reflect;
    },
    dispose() {
      sea.geometry.dispose();
      material.dispose();
    },
  };
}
