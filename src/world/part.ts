import type { Object3D } from 'three/webgpu';
import type { Pose } from '../journey/camera';
import type { FrameState } from '../journey/timeline';
import type { HourPreset } from '../journey/types';
import type { TierSettings } from '../quality/tiers';

/** What every world part reads each frame. */
export interface WorldFrame {
  state: FrameState;
  hour: HourPreset;
  pose: Pose;
  timeS: number;
  dtS: number;
}

/** The shape every world part shares (spec §7 rule 2; load/setFade arrive with stage B detail in M3). */
export interface WorldPart {
  readonly object: Object3D;
  update(f: WorldFrame): void;
  setTier(t: TierSettings): void;
  dispose(): void;
}
