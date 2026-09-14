import type { Tier } from '../quality/tiers';

export interface GuiBindings {
  getTier(): Tier;
  setTier(tier: Tier): void;
  seaUniforms: { marchSteps: { value: number } };
}

/** Live sliders for look-dev. Loaded with a dynamic import, so lil-gui never ships to visitors. */
export async function createGui(bindings: GuiBindings): Promise<void> {
  const { default: GUI } = await import('lil-gui');
  const gui = new GUI({ title: 'Moonsink (dev)' });
  const state = { tier: bindings.getTier() };
  gui
    .add(state, 'tier', [0, 1, 2, 3, 4])
    .name('quality tier')
    .onChange((value: number) => bindings.setTier(value as Tier));
  gui.add(bindings.seaUniforms.marchSteps, 'value', 16, 160, 1).name('march steps');
}
