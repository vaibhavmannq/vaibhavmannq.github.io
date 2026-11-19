import {
  attribute,
  cameraPosition,
  float,
  instancedBufferAttribute,
  mix,
  smoothstep,
  uniform,
  uv,
  vec3,
} from 'three/tsl';
import {
  DoubleSide,
  InstancedBufferAttribute,
  Mesh,
  MeshBasicNodeMaterial,
  type Node,
  PlaneGeometry,
} from 'three/webgpu';
import type { CaveShot } from '../journey/shots';
import { toThree } from '../journey/types';
import { mulberry32 } from '../shared/random';
import type { WorldPart } from './part';
import type { Sky } from './sky';

type F = Node<'float'>;
type V3 = Node<'vec3'>;

/**
 * Vines on the cave's lip (plan M7 Task 6; owner cave 5: moss and fern on the mouth's lip; the render's hanging vines,
 * D5: their square leaves were a flaw). Strands hang from the upper edge of the mouth, each a column of leaf-shaped
 * cut-out cards (alpha test, no blending), dark against the dawn with the sky showing through their edges; they sway at
 * force 1 (book §2: a breath, the tips most). One instanced draw.
 */

/** Per leaf: x, y, z (cave-local), size, depth below the strand's top (m), phase, turn. */
export const LEAF_STRIDE = 7;

/** Where strands hang: shell vertices just outside the mouth's cut, high on its rim. Pure. */
export function vineLeaves(shell: Float32Array, open: Float32Array, mouthZ: number, seed = 919): Float32Array {
  const rnd = mulberry32(seed);
  const rim: number[][] = [];
  for (let i = 0; i < open.length; i++) {
    const o = open[i] ?? -2;
    const z = shell[i * 3 + 2] ?? 0;
    if (o > -0.35 && o < -0.05 && z > mouthZ + 1.5) rim.push([shell[i * 3] ?? 0, shell[i * 3 + 1] ?? 0, z]);
  }
  const out: number[] = [];
  const tops: number[][] = [];
  for (let t = 0; t < 400 && tops.length < 44; t++) {
    // clumps: every other strand starts beside the one before
    const prev = tops[tops.length - 1];
    const p =
      prev && rnd() < 0.55
        ? rim.find((q) => Math.hypot((q[0] ?? 0) - (prev[0] ?? 0), (q[1] ?? 0) - (prev[1] ?? 0)) < 0.45 && q !== prev)
        : rim[Math.floor(rnd() * rim.length)];
    if (!p || tops.some((q) => Math.hypot((q[0] ?? 0) - (p[0] ?? 0), (q[1] ?? 0) - (p[1] ?? 0)) < 0.16)) continue;
    tops.push(p);
    // a long tail of lengths: most short, a few reaching 3 m
    const len = 0.5 + 2.8 * rnd() ** 2.2;
    const n = Math.max(5, Math.round(len / 0.085));
    const phase = rnd() * Math.PI * 2;
    for (let k = 0; k < n; k++) {
      const d = (k / n) * len;
      const j = 0.14 * (1 - d / (len + 0.5));
      out.push(
        (p[0] ?? 0) + j * (rnd() - 0.5),
        (p[1] ?? 0) + j * (rnd() - 0.5),
        (p[2] ?? 0) - d,
        (0.15 + 0.13 * rnd()) * (1 - 0.35 * (d / len)),
        d,
        phase,
        rnd() * Math.PI * 2,
      );
    }
  }
  return new Float32Array(out);
}

export function createVines(leaves: Float32Array, cave: CaveShot, sky: Sky): WorldPart {
  const n = leaves.length / LEAF_STRIDE;
  const a = new Float32Array(n * 4);
  const b = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const L = (k: number) => leaves[i * LEAF_STRIDE + k] ?? 0;
    const w = toThree([L(0) + cave.x, L(1) + cave.y, L(2) + cave.floor]);
    a.set([w[0], w[1], w[2], L(3)], i * 4);
    b.set([L(4), L(5), L(6), 0], i * 4);
  }
  const ia = instancedBufferAttribute(new InstancedBufferAttribute(a, 4)) as unknown as Node<'vec4'>;
  const ib = instancedBufferAttribute(new InstancedBufferAttribute(b, 4)) as unknown as Node<'vec4'>;
  const clock = uniform(0);
  const geo = new PlaneGeometry(1, 1);
  const p = attribute('position', 'vec3');
  const turn = ib.z;
  const depth = ib.x;
  // the leaf hangs from its stalk (top of the card), turned about the strand
  const local = vec3(p.x.mul(turn.cos()), p.y.sub(0.5), p.x.mul(turn.sin())).mul(ia.w);
  // sway: force 1 (Before dawn's world state), the tips most; a slow breath and a quicker flutter of each leaf
  const sway = depth.pow(1.5).mul(0.085);
  const swing = clock.mul(0.7).add(ib.y).sin().mul(sway);
  const flutter = clock
    .mul(2.3)
    .add(ib.y.mul(3).add(depth.mul(5)))
    .sin()
    .mul(0.25);
  const material = new MeshBasicNodeMaterial({ side: DoubleSide, alphaTest: 0.5 });
  material.name = 'vines.material';
  material.positionNode = ia.xyz
    .add(local.add(vec3(swing, 0, swing.mul(0.6))))
    .add(vec3(local.z.mul(flutter), 0, local.x.mul(flutter).negate()).mul(0.4)) as unknown as V3;
  // leaf shape: pointed at both ends, widest a third down (ivy-like), a notch of a midrib
  const u = uv();
  const y = float(1).sub(u.y);
  const half = y
    .mul(Math.PI)
    .sin()
    .pow(0.75)
    .mul(float(1).sub(y.mul(0.35)))
    .mul(0.48);
  const inside = smoothstep(half, half.sub(0.04), u.x.sub(0.5).abs());
  const rib = smoothstep(0.0, 0.015, u.x.sub(0.5).abs()).mul(0.3).add(0.7);
  material.opacityNode = inside as F;
  // dark leaves; the dawn shows through their thin edges (and a little through the leaf), toward the eye's side
  const mouthDir = vec3(
    ...toThree([Math.sin((cave.az * Math.PI) / 180), Math.cos((cave.az * Math.PI) / 180), 0.15]),
  ).normalize();
  const through = sky.colorAt(mouthDir as unknown as V3).mul(0.022);
  const facing = cameraPosition.sub(ia.xyz).normalize().dot(mouthDir).negate().clamp(0, 1);
  material.colorNode = mix(vec3(0.006, 0.01, 0.008), vec3(0.012, 0.026, 0.012).add(through), facing).mul(
    rib,
  ) as unknown as V3;
  const mesh = new Mesh(geo, material);
  mesh.count = n;
  mesh.frustumCulled = false;
  return {
    object: mesh,
    update(f) {
      clock.value = f.timeS;
      const [x, , z] = f.pose.position;
      const [cx, , cz] = toThree([cave.x, cave.y, 0]);
      mesh.visible = Math.hypot(x - cx, z - cz) < 400;
    },
    setTier() {},
    dispose() {
      geo.dispose();
      material.dispose();
    },
  };
}
