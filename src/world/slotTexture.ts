import { type Texture, TextureNode } from 'three/webgpu';

/**
 * A texture node with a binding of its own (R121, plan M8 Task 1). three r186 shares one binding between texture nodes
 * that hold the same Texture (`TextureNode.getUniformHash` is the texture's uuid), so a shader built while two nodes
 * held one texture differs from the one needed when they hold two. The sky's hour slots hold one texture at a stop and
 * two in a flight: every fogged material pre-built at rest was rebuilt mid-flight (0.6–1.2 s on the laptop). A slot's
 * hash is its name, so the shader is the same whatever the slots hold. Samples (`.sample`, clones) keep the slot.
 */
class SlotTextureNode extends TextureNode {
  slot = '';
  override getUniformHash(): string {
    const base = this.getBase() as SlotTextureNode;
    return base.slot ? `slot:${base.slot}` : this.value.uuid;
  }
}

export function slotTexture(value: Texture, slot: string): TextureNode {
  const node = new SlotTextureNode(value);
  node.slot = slot;
  return node;
}
