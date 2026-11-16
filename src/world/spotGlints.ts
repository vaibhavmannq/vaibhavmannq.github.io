import { float, smoothstep, uniform, uv, vec3 } from 'three/tsl';
import { AdditiveBlending, Group, Sprite, SpriteNodeMaterial, Vector3 } from 'three/webgpu';
import { glintAt, type SpotPath } from '../journey/spots';
import { stopIndex } from '../journey/stops';
import { toThree } from '../journey/types';
import type { WorldPart } from './part';

/**
 * The soft glints that mark where a visitor can walk (Amendment 1 §6 step 2): one per spot, at its path's end, a
 * hand's height over the ground, breathing slowly. Shown only while resting at the spot's stop and not walking.
 */
export interface SpotGlints extends WorldPart {
  /** world positions (three.js), one per spot, for picking */
  readonly at: { spot: SpotPath; position: Vector3; sprite: Sprite }[];
  setWalking(on: boolean): void;
}

export function createSpotGlints(spots: readonly SpotPath[]): SpotGlints {
  const breath = uniform(1);
  const material = new SpriteNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending });
  const r = uv().sub(0.5).length().mul(2);
  material.colorNode = vec3(1.0, 0.9, 0.7)
    .mul(
      float(1)
        .sub(smoothstep(0.0, 1.0, r))
        .pow(2.2),
    )
    .mul(breath)
    .mul(1.4);
  const group = new Group();
  const at = spots.map((spot) => {
    const p = toThree(glintAt(spot));
    const sprite = new Sprite(material);
    sprite.position.set(...p);
    // a glint farther than Golden's few metres keeps about the same size on screen
    const end = spot.points[0] ?? [0, 0, 0];
    const far = Math.hypot(p[0] - end[0], p[2] + end[1]);
    sprite.scale.setScalar(0.22 * Math.max(1, far / 6));
    sprite.userData.stop = stopIndex(spot.stop);
    group.add(sprite);
    return { spot, position: new Vector3(...p), sprite };
  });
  group.visible = false;
  let walking = false;
  const stops = new Set(spots.map((s) => stopIndex(s.stop)));
  return {
    object: group,
    at,
    setWalking(on) {
      walking = on;
    },
    update(f) {
      group.visible = !walking && f.state.resting && stops.has(f.state.a);
      // only the glints of the stop the visitor rests at (plan M3 Task 7)
      if (group.visible) for (const g of at) g.sprite.visible = g.sprite.userData.stop === f.state.a;
      breath.value = 0.65 + 0.35 * Math.sin(2 * Math.PI * 0.4 * f.timeS);
    },
    setTier() {},
    dispose() {
      material.dispose();
    },
  };
}
