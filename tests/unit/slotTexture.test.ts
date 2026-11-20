import { Texture } from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { slotTexture } from '../../src/world/slotTexture';

// R121 (plan M8 Task 1): three r186 shares a texture binding between texture nodes that hold the same Texture (the
// uniform hash is the texture's uuid). The sky's two hour slots hold one texture at rest and two in flight, so every
// fogged shader built at rest was rebuilt mid-flight. A slot keeps its own binding whatever it holds.
describe('slotTexture', () => {
  const hash = (n: unknown) => (n as { getUniformHash(b?: unknown): string }).getUniformHash();
  it('gives two slots their own binding even when they hold the same texture', () => {
    const t = new Texture();
    const a = slotTexture(t, 'sky-a');
    const b = slotTexture(t, 'sky-b');
    expect(hash(a)).not.toBe(hash(b));
  });
  it('keeps the slot for its samples, and follows the slot when its texture changes', () => {
    const t = new Texture();
    const a = slotTexture(t, 'sky-a');
    const s = a.sample([0.5, 0.5] as never);
    expect(hash(s)).toBe(hash(a));
    a.value = new Texture();
    expect(hash(s)).toBe(hash(a));
    expect((s as unknown as { value: Texture }).value).toBe(a.value);
  });
});
