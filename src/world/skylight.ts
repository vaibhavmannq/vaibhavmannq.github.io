import {
  cameraPosition,
  float,
  mx_noise_float,
  normalWorld,
  positionWorld,
  smoothstep,
  uniform,
  vec3,
} from 'three/tsl';
import { AdditiveBlending, CylinderGeometry, FrontSide, Mesh, MeshBasicNodeMaterial, type Node } from 'three/webgpu';
import type { CaveShot } from '../journey/shots';
import { toThree } from '../journey/types';
import type { WorldPart } from './part';
import type { Sky } from './sky';

type V3 = Node<'vec3'>;

/**
 * The skylight (plan M7 Task 7; owner cave 1, Benagil): a hole in the chamber's roof and the shaft under it. An option
 * (`?skylight=off` hides it). Before dawn the sun is 10° below the horizon (book §1), so no beam exists: the hole lets
 * in only the zenith's deep blue, and the column shows only where the cave's damp air catches it. So the shaft is cool,
 * faint and soft-edged, widening toward the floor (the hole is a broad source), with slow drifting mist in it.
 */

/** Where the hole is, cave-local (ahead and right of the stop's camera, against the dark wall beside the mouth), its radius, metres. */
export const SKYLIGHT = { x: 3.6, y: 2.2, r: 0.95 } as const;

/** Raises the shell's `open` around the hole in the roof (> 0 is cut), its edge left to the shader's noise. Pure. */
export function openRoof(shell: Float32Array, open: Float32Array, minZ = 7): Float32Array {
  const out = Float32Array.from(open);
  for (let i = 0; i < out.length; i++) {
    const z = shell[i * 3 + 2] ?? 0;
    if (z < minZ) continue;
    const d = Math.hypot((shell[i * 3] ?? 0) - SKYLIGHT.x, (shell[i * 3 + 1] ?? 0) - SKYLIGHT.y);
    out[i] = Math.max(out[i] ?? -2, Math.min(0.6, Math.max(-2, (SKYLIGHT.r - d) * 1.5)));
  }
  return out;
}

export function createSkylight(cave: CaveShot, sky: Sky, roofZ: number): WorldPart {
  const h = roofZ;
  const geo = new CylinderGeometry(SKYLIGHT.r * 0.9, SKYLIGHT.r * 1.7, h, 28, 1, true);
  const [x, y, z] = toThree([cave.x + SKYLIGHT.x, cave.y + SKYLIGHT.y, cave.floor + h / 2]);
  geo.translate(x, y, z);
  const clock = uniform(0);
  const material = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: FrontSide,
  });
  material.name = 'skylight.material';
  // thicker through the middle than at the edges (the path through a cone), brightest under the hole, fading to the
  // floor; damp air drifting through it slowly (book §4: calm, it hangs)
  const view = cameraPosition.sub(positionWorld).normalize();
  const through = normalWorld.dot(view).abs().pow(1.6);
  const hz = positionWorld.y.sub(cave.floor);
  const fall = smoothstep(0, h * 0.25, hz).mul(
    smoothstep(h, h * 0.55, hz)
      .mul(0.6)
      .add(0.4),
  );
  const mist = mx_noise_float(
    vec3(positionWorld.x.mul(0.9), hz.mul(0.35).sub(clock.mul(0.05)), positionWorld.z.mul(0.9)),
  )
    .mul(0.5)
    .add(0.65);
  const zenith = sky.colorAt(vec3(0, 1, 0) as unknown as V3);
  material.colorNode = zenith.mul(through.mul(fall).mul(mist).mul(0.26)).add(float(0)) as unknown as V3;
  const mesh = new Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  return {
    object: mesh,
    update(f) {
      clock.value = f.timeS;
      const [px, , pz] = f.pose.position;
      mesh.visible = Math.hypot(px - x, pz - z) < 60;
    },
    setTier() {},
    dispose() {
      geo.dispose();
      material.dispose();
    },
  };
}

/** The roof's height over the floor above a point (mean of the shell's high vertices within 1.2 m), metres. Pure. */
export function roofAbove(shell: Float32Array, at: { x: number; y: number }): number {
  let s = 0;
  let n = 0;
  for (let i = 0; i < shell.length; i += 3) {
    if ((shell[i + 2] ?? 0) < 7) continue;
    if (Math.hypot((shell[i] ?? 0) - at.x, (shell[i + 1] ?? 0) - at.y) < 1.2) {
      s += shell[i + 2] ?? 0;
      n++;
    }
  }
  return n ? s / n : 10;
}
