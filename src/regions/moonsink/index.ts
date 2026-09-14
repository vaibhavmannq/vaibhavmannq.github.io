import { PerspectiveCamera, Scene } from 'three/webgpu';
import type { TierSettings } from '../../quality/tiers';
import { disposeObject } from '../../shared/dispose';
import type { Region, RegionContext } from '../region';
import {
  approachPose,
  type CameraPose,
  followPose,
  fovForAspect,
  idlePose,
  MOONSINK_PATH,
  poseAt,
  reducedMotionTarget,
  SEA_FOV,
  toThreeCamera,
} from './cameraPath';
import { moonLight, resolveMoonPhase } from './moonPhase';
import { createSea, type SeaUniforms } from './sea';

export interface MoonsinkRegion extends Region {
  /** False while the opening is up: the camera bobs on the open sea instead of following the scroll. */
  setEntered(entered: boolean): void;
  readonly seaUniforms: SeaUniforms;
}

/**
 * @param moonOverride `?moon=` debug override (0..1, already clamped by readDebugParams), or
 *   undefined to use tonight's real phase. Set once here, from `new Date()`, and never mutated
 *   per-frame — see spec §5.4b.
 */
export function createMoonsink(ctx: RegionContext, moonOverride?: number): MoonsinkRegion {
  const scene = new Scene();
  const camera = new PerspectiveCamera(SEA_FOV, window.innerWidth / window.innerHeight, 0.1, 400);
  const sea = createSea();
  scene.add(sea.mesh);

  const phase = resolveMoonPhase(new Date(), moonOverride);
  sea.uniforms.moonPhase.value = phase;
  sea.uniforms.moonLight.value = moonLight(phase);

  let entered = false;
  // `current` is the camera's own persistent pose, mutated in place every frame from here on.
  // poseAt/idlePose/reducedMotionTarget hand back a short-lived scratch object each call (see
  // cameraPath.ts) — copy it here at construction, and never let `current` itself become one of
  // those scratch objects below, or a later unrelated call would silently overwrite it.
  const current: CameraPose = { ...poseAt(MOONSINK_PATH, 0) };

  const applyPose = (pose: CameraPose) => {
    const { position, rotation } = toThreeCamera(pose);
    camera.position.set(position[0], position[1], position[2]);
    camera.rotation.set(rotation[0], rotation[1], rotation[2], 'YXZ');
  };
  applyPose(current);

  return {
    id: 'moonsink',
    scene,
    camera,
    seaUniforms: sea.uniforms,
    setEntered(value) {
      entered = value;
    },
    update(local, timeSeconds, dtSeconds) {
      sea.uniforms.time.value = timeSeconds;

      let target: CameraPose;
      if (!entered) target = idlePose(timeSeconds, ctx.reducedMotion);
      else if (ctx.reducedMotion) target = reducedMotionTarget(local);
      else target = poseAt(MOONSINK_PATH, local);

      // Reduced motion cuts straight to the viewpoint; otherwise the camera glides after the
      // target. Both branches write into `current` in place rather than repointing the variable
      // at `target`, which cameraPath.ts reuses as scratch space on the next call.
      if (ctx.reducedMotion) {
        current.x = target.x;
        current.y = target.y;
        current.z = target.z;
        current.yaw = target.yaw;
        current.pitch = target.pitch;
      } else if (entered) {
        // The journey camera moves with the scroll (journey-flow design §5.2).
        followPose(current, target, dtSeconds);
      } else {
        // The idle bob behind the opening keeps its gentle, capped easing.
        approachPose(current, target, dtSeconds);
      }
      applyPose(current);
    },
    resize(width, height) {
      camera.aspect = width / height;
      camera.fov = fovForAspect(SEA_FOV, camera.aspect);
      camera.updateProjectionMatrix();
    },
    applyTier(settings: TierSettings) {
      sea.uniforms.marchSteps.value = settings.marchSteps;
    },
    dispose() {
      disposeObject(scene);
    },
  };
}
