import type { MeshStandardNodeMaterial } from 'three/webgpu';
import type { StacksMeta } from '../assets/manifest';
import type { FrameState } from '../journey/timeline';
import { STOP_IDS } from '../journey/types';
import { type ArchParts, decodeArch, rockMesh } from './arch';
import { STACKS_SEEN_FROM, STACKS_SEEN_ON } from './headland';
import type { WorldPart } from './part';

/** The stacks' decoded file: the same layout and attributes as the arch's (export_parts.py `_rock_bin`). */
export type StacksParts = ArchParts;

/** Reads stacks.bin (layout: tools/world/blender/export_parts.py `_rock_bin`, as arch.bin). */
export function decodeStacks(buf: ArrayBuffer, meta: StacksMeta): StacksParts {
  return decodeArch(buf, meta);
}

export { STACKS_SEEN_FROM, STACKS_SEEN_ON };

export function stacksInPlay(state: FrameState): boolean {
  const a = STOP_IDS[state.a];
  const b = STOP_IDS[state.b];
  if (!a || !b) return false;
  return state.kind === 'stop' ? STACKS_SEEN_FROM.has(a) : STACKS_SEEN_ON.has(`${a}>${b}`);
}

/**
 * The old headland line seaward and landward of the arch (owner cove-and-stacks 12; reference-landforms §2; M2.5
 * Task 3c), baked from coast.py's build_stacks: spires that get smaller out to sea, wedges, the parent mass's broken
 * block, stumps and a reef, each on a flared foot with the wave-cut notch, on its wave-cut shelf among fallen blocks.
 * One mesh, one draw, the arch's rock material (pass the same instance: D13), per-vertex baked light. Skirts run on
 * below the flats, so no foot floats and the height field is untouched.
 */
export function createStacks(
  parts: StacksParts,
  at: { x: number; y: number },
  material: MeshStandardNodeMaterial,
): WorldPart {
  const mesh = rockMesh(parts, at, material);
  return {
    object: mesh,
    update(f) {
      mesh.visible = stacksInPlay(f.state);
    },
    setTier() {},
    dispose() {
      mesh.geometry.dispose();
    },
  };
}
