import type { PerspectiveCamera, Scene } from 'three/webgpu';
import type { RegionId } from '../journey/types';
import type { TierSettings } from '../quality/tiers';

/** Shared, mutable settings every region reads each frame. */
export interface RegionContext {
  reducedMotion: boolean;
}

/** Every region has the same shape, so the rest of the app never needs to know which one it is (spec §5.2). */
export interface Region {
  readonly id: RegionId;
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  /** local = 0..1 through this region; timeSeconds drives shader animation. */
  update(local: number, timeSeconds: number, dtSeconds: number): void;
  resize(width: number, height: number): void;
  applyTier(settings: TierSettings): void;
  dispose(): void;
}
