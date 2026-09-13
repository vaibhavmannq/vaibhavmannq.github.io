import { PerspectiveCamera, Scene } from 'three/webgpu';
import type { TierSettings } from '../../quality/tiers';
import { disposeObject } from '../../shared/dispose';
import type { Region, RegionContext } from '../region';
import {
  approachPose,
  type CameraPose,
  fovForAspect,
  idlePose,
  MOONSINK_PATH,
  poseAt,
  reducedMotionTarget,
  SEA_FOV,
  toThreeCamera,
} from './cameraPath';
import { createRing } from './ring';
import { createSea, type SeaUniforms } from './sea';

export interface MoonsinkRegion extends Region {
  /** False while the title screen is up: the camera bobs on the open sea instead of following the scroll. */
  setEntered(entered: boolean): void;
  readonly seaUniforms: SeaUniforms;
}

export function createMoonsink(ctx: RegionContext): MoonsinkRegion {
  const scene = new Scene();
  const camera = new PerspectiveCamera(SEA_FOV, window.innerWidth / window.innerHeight, 0.1, 400);
  const sea = createSea();
  const ring = createRing();
  scene.add(sea.mesh, ring.group);

  let entered = false;
  let current: CameraPose = poseAt(MOONSINK_PATH, 0);

  const applyPose = (pose: CameraPose) => {
    const { position, rotation } = toThreeCamera(pose);
    camera.position.set(position[0], position[1], position[2]);
    camera.rotation.set(rotation[0], rotation[1], rotation[2], 'YXZ');
    sea.uniforms.yaw.value = pose.yaw;
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

      // Reduced motion cuts straight to the viewpoint; otherwise the camera glides after the target
      current = ctx.reducedMotion ? target : approachPose(current, target, dtSeconds);
      applyPose(current);
      ring.update(timeSeconds, ctx.reducedMotion);
    },
    resize(width, height) {
      camera.aspect = width / height;
      camera.fov = fovForAspect(SEA_FOV, camera.aspect);
      camera.updateProjectionMatrix();
    },
    applyTier(settings: TierSettings) {
      sea.uniforms.marchSteps.value = settings.marchSteps;
      sea.uniforms.waveDetail.value = settings.waveDetail;
    },
    dispose() {
      disposeObject(scene);
    },
  };
}
