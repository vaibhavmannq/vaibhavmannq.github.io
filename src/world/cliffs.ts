import type { MeshStandardNodeMaterial } from 'three/webgpu';
import type { CliffsMeta } from '../assets/manifest';
import type { FrameState } from '../journey/timeline';
import { STOP_IDS } from '../journey/types';
import { type ArchParts, decodeArch, rockMesh } from './arch';
import { COVE_SEEN_FROM, COVE_SEEN_ON, COVE_SPAN } from './cove';
import type { WorldPart } from './part';

/** Pure: whether the cove's rock and trees are drawn in this frame. */
export function coveInPlay(state: Pick<FrameState, 'kind' | 'a' | 'b' | 't'>): boolean {
  const a = STOP_IDS[state.a];
  const b = STOP_IDS[state.b];
  if (!a || !b) return false;
  if (state.kind === 'stop') return COVE_SEEN_FROM.has(a);
  const key = `${a}>${b}` as const;
  if (!COVE_SEEN_ON.has(key)) return false;
  const span = COVE_SPAN[key];
  return !span || (state.t >= span[0] && state.t <= span[1]);
}

/** cliffs.bin has arch.bin's layout (export_parts.py `_rock_bin`), around the columns' middle. */
export function decodeCliffs(buf: ArrayBuffer, meta: CliffsMeta): ArchParts {
  return decodeArch(buf, meta);
}

/**
 * The cove's cliff columns (plan M3 Task 2; owner cove-and-stacks 1, 3, 4: a cliff is a vertical rock face in beds, never
 * a smooth green ramp): coast.py cliff_rocks along the right headland at Golden (x ≈ 22) and the left one at Sunrise
 * (x ≈ −102), each built by the renders' rock_column. One mesh, one draw, the shared rock material (pass the same
 * instance: D13), the sky light baked with the ground behind them; moss caps their tops.
 */
export function createCliffs(
  parts: ArchParts,
  at: { x: number; y: number },
  material: MeshStandardNodeMaterial,
): WorldPart {
  const mesh = rockMesh(parts, at, material);
  return {
    object: mesh,
    update(f) {
      mesh.visible = coveInPlay(f.state);
    },
    setTier() {},
    dispose() {
      mesh.geometry.dispose();
    },
  };
}
