import { describe, expect, it } from 'vitest';
import { keyBuildsByOwnContext } from '../../src/render/pipeline';

// R38 (plan M6): three.js r186 caches a shader's shared camera uniforms by renderer._currentRenderContext at build time.
// A compileAsync builds after the call returns (no context set), so the eye's and the mirror's builds shared one camera.
describe('keyBuildsByOwnContext', () => {
  const fake = () => {
    const r = { _currentRenderContext: null as unknown, debug: { onNodeBuilderCreated: null as unknown } };
    const seen: unknown[] = [];
    const builder = {
      _getBindGroup(name: string) {
        seen.push(r._currentRenderContext);
        return name;
      },
    };
    return { r, seen, builder };
  };

  it("keys each build's bind groups by its own render object's context, then restores the renderer's", () => {
    const { r, seen, builder } = fake();
    keyBuildsByOwnContext(r as never);
    const mirrorCtx = { id: 4 };
    (r.debug.onNodeBuilderCreated as (b: unknown, ro: unknown) => void)(builder, { context: mirrorCtx });
    expect(builder._getBindGroup('render')).toBe('render');
    expect(seen).toEqual([mirrorCtx]);
    expect(r._currentRenderContext).toBeNull();
  });

  it('keeps a hook that was already installed, and leaves builders without a render object alone', () => {
    const { r, seen, builder } = fake();
    const calls: unknown[] = [];
    r.debug.onNodeBuilderCreated = (b: unknown) => calls.push(b);
    keyBuildsByOwnContext(r as never);
    (r.debug.onNodeBuilderCreated as (b: unknown, ro: unknown) => void)(builder, undefined);
    builder._getBindGroup('render');
    expect(calls).toEqual([builder]);
    expect(seen).toEqual([null]);
  });
});
