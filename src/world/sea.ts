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
  mx_noise_vec3,
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
import type { Camera, RenderTarget } from 'three/webgpu';
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
  Vector2,
} from 'three/webgpu';
import type { TierSettings } from '../quality/tiers';
import type { GridMeta } from './heights';
import { fishRing, RING_SPEED } from './life';
import { glitterCarry, glitterPower, type LightUniforms } from './light';
import { EYE_ONLY_LAYER } from './meadow';
import { mirrorCubic } from './mirrorSample';
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

/**
 * Pure: how much surf foam the wind force allows (plan M3 Task 3). Reference book §2: force 0 is "like a mirror",
 * force 1 ripples with no crests, force 2 glassy wavelets; §3: a white line of foam that comes and goes where the sea
 * meets the land. So at force 0–1 the edge line is faint and the swash sheet nearly gone; both full from force 2.
 */
export function foamLevel(beaufort: number): { edge: number; sheet: number } {
  const b = Math.max(0, beaufort);
  return { edge: Math.min(1, 0.35 + 0.65 * Math.min(1, b / 2)), sheet: Math.min(1, Math.max(0, (b - 0.5) / 1.5)) };
}

/**
 * Where the sea's mirror draws, for a given eye camera: its own camera (a clone made on first use) and its render target.
 * The pipeline builds every part's shaders for it ahead of time (R38, plan M6): the mirror draws one level deeper than
 * the scene pass, which three.js r186 keys apart, so a part first seen in the mirror was built mid-flight.
 */
export interface Mirror {
  camera(eye: Camera): Camera;
  target(eye: Camera): RenderTarget;
}

export function createSea(
  heights: DataTexture,
  meta: GridMeta,
  u: LightUniforms,
  tier: TierSettings,
): WorldPart & { mirror: Mirror | null } {
  const reflection = reflector({ resolutionScale: tier.reflect });
  reflection.target.rotateX(-Math.PI / 2);
  // The mirror's camera is a clone of the eye's, made on first use: it leaves out the cove's plants (EYE_ONLY_LAYER),
  // whose cost the mirror would double for blades it barely shows (plan M3 Task 1).
  const base = (
    reflection as unknown as {
      reflector?: { getVirtualCamera(c: Camera): Camera; getRenderTarget(c: Camera): RenderTarget };
    }
  ).reflector;
  if (base) {
    const own = base.getVirtualCamera.bind(base);
    base.getVirtualCamera = (c: Camera) => {
      const v = own(c);
      v.layers.disable(EYE_ONLY_LAYER);
      return v;
    };
  }
  const chop = uniform(1);
  const foamEdge = uniform(1);
  const foamSheet = uniform(1);
  const glitterPow = uniform(glitterPower(0.55));
  /** how far the glitter's facets have drifted along the wind, metres (three.js x, z; light.ts glitterCarry) */
  const carried = uniform(new Vector2(0, 0));

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
  // First light's fish ring (plan M3 Task 6, life.ts; reference book §3, §10): one ring and no splash, spreading at
  // RING_SPEED, a few ripples wide, gone within seconds. It tilts the facets, so it shows as a ring broken in the mirror.
  const rd = p.sub(fishRing.at);
  const rl = rd.length().max(0.001);
  const off = rl.sub(fishRing.age.mul(RING_SPEED));
  const ringSlope = cos(off.mul((2 * Math.PI) / 0.5))
    .mul(exp(off.div(0.6).pow(2).negate()))
    .mul(exp(fishRing.age.div(-2.2)))
    .mul(smoothstep(0, 0.3, fishRing.age))
    .mul(fishRing.amp)
    .mul(1.6);
  gx = gx.add(rd.x.div(rl).mul(ringSlope));
  gz = gz.add(rd.y.div(rl).mul(ringSlope));
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
  const body = (u.ambSky as unknown as Node<'vec3'>).mul(vec3(0.05, 0.07, 0.08));
  // The sun's or moon's road as glitter (plan M2.5 Task 5; reference book §3: thousands of separate glints from wave
  // facets; a calmer sea gives a narrower road). Each facet gets its own small random slope and glints only when it
  // mirrors the sun or moon exactly; the spread of slopes sets the road's width (glitterPower's lobe: σ ≈ 0.04 at
  // force 1, less on a mirror). Facets drift 0.05 m/s with the wind. Two sizes (25 cm near, 2 m far); each fades to the
  // road's mean where one facet is under two pixels (Review Focus 4: no far shimmer). Ruling R23: the plan's single
  // 0.6 cycles/m read as cartoon spots under a 0.75 m-high camera.
  const sigma = chop.mul(0.04 / 0.55);
  const r0 = reflect(v.negate(), n);
  const mean = max(dot(r0, u.keyDir), 0).pow(glitterPow).mul(0.35);
  const facetGlint = (freq: number, seed: number) => {
    const q = p.add(carried);
    const t = mx_noise_vec3(vec3(q.mul(freq), time.mul(0.6).add(seed)));
    const nf = normalize(n.add(vec3(t.x, 0, t.y).mul(sigma.mul(2.2))));
    const hit = max(dot(reflect(v.negate(), nf), u.keyDir), 0)
      .pow(1800)
      .mul(5.0);
    const facetPx = float(1 / freq).div(pixel.max(1e-4));
    return mix(mean, hit, smoothstep(2.0, 4.0, facetPx));
  };
  // no road from a light that is out (s17: Blue hour's sun is 6° down with strength 0; a breath of wind let its facets
  // glint as a white blob on the flats)
  const glint = max(facetGlint(4.0, 0), facetGlint(0.5, 11))
    .mul(u.keyColor)
    .mul(6.0)
    .mul(smoothstep(0.0, 0.05, u.keyStrength))
    // and none while the key light swings from one light to another (M8.5 #3b: a blob on Blue hour → Night's water)
    .mul(u.road);
  // the mirror read smooth (mirrorSample.ts): one bilinear tap stair-stepped its edges at 3–8× magnification (s22)
  const mirrored = reflection.uvNode ? mirrorCubic(reflection, reflection.uvNode as Node<'vec2'>) : reflection.rgb;
  let col = mix(body, mirrored, fresnel).add(glint);

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
  const foam = max(edge.mul(foamEdge), sheet.mul(foamSheet))
    .mul(lace)
    .mul(smoothstep(160.0, 40.0, dist));
  col = mix(col, u.ambSky.mul(1.8).add(u.keyColor.mul(0.45)), foam.clamp(0, 1));

  const material = new MeshBasicNodeMaterial({ transparent: true });
  material.name = 'sea.material';
  material.colorNode = col;
  material.opacityNode = smoothstep(0.0, 0.35, depth).mul(0.85).add(fresnel.mul(0.15)).max(foam).clamp(0, 1);
  const sea = new Mesh(new PlaneGeometry(16000, 16000, 1, 1), material);
  sea.rotation.x = -Math.PI / 2;
  sea.renderOrder = 1;
  const group = new Group();
  group.add(sea, reflection.target);
  const mirror: Mirror | null = base
    ? {
        camera: (eye) => base.getVirtualCamera(eye),
        target: (eye) => base.getRenderTarget(base.getVirtualCamera(eye)),
      }
    : null;

  return {
    object: group,
    mirror,
    update(f) {
      // reference book §2 (Beaufort, "on water"): the chop grows with the force, 0.3 calm to 1.3 at force 4
      chop.value = 0.3 + 0.25 * f.hour.world.beaufort;
      glitterPow.value = glitterPower(chop.value);
      const fl = foamLevel(f.hour.world.beaufort);
      foamEdge.value = fl.edge;
      foamSheet.value = fl.sheet;
      const [cx, cz] = glitterCarry([carried.value.x, carried.value.y], f.hour.world, f.dtS);
      carried.value.set(cx, cz);
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
