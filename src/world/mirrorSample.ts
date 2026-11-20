import { float, floor, int, textureSize, vec2 } from 'three/tsl';
import type { Node, TextureNode } from 'three/webgpu';

/**
 * The mirror read with a cubic B-spline filter in four bilinear taps (GPU Gems 2, ch. 20) instead of one bilinear tap.
 * The mirror is drawn at a fraction of the screen (tiers.ts `reflect`), so one bilinear tap magnifies it 3–8× into
 * stair-stepped edges (s22, Dusk: tree and cliff outlines as blocks); the B-spline turns those steps into a soft edge,
 * the look of a calm surface's faint ripples, for three more texture reads on the sea's pixels and no extra pixels drawn.
 */
export function mirrorCubic(mirror: TextureNode, uv: Node<'vec2'>): Node<'vec3'> {
  const size = vec2(textureSize(mirror, int(0)) as unknown as Node<'ivec2'>);
  const st = uv.mul(size).sub(0.5);
  const i = floor(st);
  const f = st.sub(i);
  const f2 = f.mul(f);
  const f3 = f2.mul(f);
  const w0 = float(1).sub(f).pow(3).div(6);
  const w1 = f3.mul(3).sub(f2.mul(6)).add(4).div(6);
  const w2 = f3.mul(-3).add(f2.mul(3)).add(f.mul(3)).add(1).div(6);
  const w3 = f3.div(6);
  const g0 = w0.add(w1);
  const g1 = w2.add(w3);
  const h0 = i.sub(0.5).add(w1.div(g0)).div(size);
  const h1 = i.add(1.5).add(w3.div(g1)).div(size);
  const tap = (x: Node<'float'>, y: Node<'float'>) => mirror.sample(vec2(x, y)).rgb;
  const row0 = tap(h0.x, h0.y).mul(g0.x).add(tap(h1.x, h0.y).mul(g1.x));
  const row1 = tap(h0.x, h1.y).mul(g0.x).add(tap(h1.x, h1.y).mul(g1.x));
  return row0.mul(g0.y).add(row1.mul(g1.y)) as Node<'vec3'>;
}
