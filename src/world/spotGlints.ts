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
  const r = uv().sub(0.5).length().mul(2);
  const glow = (col: [number, number, number], k: number) => {
    const m = new SpriteNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending });
    m.colorNode = vec3(...col)
      .mul(
        float(1)
          .sub(smoothstep(0.0, 1.0, r))
          .pow(2.2),
      )
      .mul(breath)
      .mul(k);
    return m;
  };
  const material = glow([1.0, 0.9, 0.7], 1.4);
  // Dusk (s35b, Task 18e): on its dark slope the cream glint read as a stray white orb; there it takes the lanterns'
  // warm candle colour, dimmer, so it reads as one more small light of the evening
  const duskMaterial = glow([1.0, 0.62, 0.32], 0.8);
  const group = new Group();
  const at = spots.map((spot) => {
    const p = toThree(glintAt(spot));
    const sprite = new Sprite(spot.stop === 'dusk' ? duskMaterial : material);
    sprite.position.set(...p);
    // Golden's two keep the size the owner has seen; elsewhere a glint is as big on screen as one 6 m off at Golden
    // (Sunset's is 2 m from the eye, First light's 18 m)
    const eye = spot.points[0] ?? [0, 0, 0];
    const far = Math.hypot(p[0] - eye[0], p[2] + eye[1]);
    sprite.scale.setScalar(spot.stop === 'golden' ? 0.22 : (0.22 * far) / 6);
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
      duskMaterial.dispose();
    },
  };
}
