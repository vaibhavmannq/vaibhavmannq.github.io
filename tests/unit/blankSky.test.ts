import { describe, expect, it } from 'vitest';
import { blankSky, prepareSky, skyTextureFromPixels } from '../../src/assets/skies';

// R121 (plan M8 Task 1): the placeholder sky sat in the sky's slots while the near parts were pre-built. It was a plain
// DataTexture (nearest, clamped), which three samples with textureLoad, so every pre-built shader was rebuilt for the
// real skies (linear, wrapped: textureSample) on its first trip.
describe('blankSky', () => {
  it('samples like a real sky, so shaders built with it serve the real ones', () => {
    const blank = blankSky();
    const real = prepareSky(skyTextureFromPixels({ width: 2, height: 1, data: new Uint8Array(8) }));
    for (const k of [
      'minFilter',
      'magFilter',
      'wrapS',
      'wrapT',
      'generateMipmaps',
      'colorSpace',
      'format',
      'type',
      'flipY',
    ] as const)
      expect(blank[k], k).toBe(real[k]);
  });
});
