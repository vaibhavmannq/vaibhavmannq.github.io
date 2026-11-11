import { float, mx_noise_float } from 'three/tsl';
import type { Node } from 'three/webgpu';

type F = Node<'float'>;
type V2 = Node<'vec2'>;

/**
 * Layered noise in 0..1, centred on 0.5, like the `Fac` output of Blender's noise texture (which coast.py's
 * materials are built from): `octaves` layers, each twice as fine and `rough` times as strong as the one before.
 */
export function fbm2(p: V2, octaves: number, rough = 0.5): F {
  let sum: F = float(0);
  let amp = 1;
  let norm = 0;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    sum = sum.add(mx_noise_float(p.mul(freq).add(i * 17.3)).mul(amp));
    norm += amp;
    amp *= rough;
    freq *= 2;
  }
  return sum.div(norm).mul(0.5).add(0.5);
}

/** Blender's Map Range, clamped: x from a..b onto c..d (a may be greater than b). */
export function remap(x: F, a: number, b: number, c = 0, d = 1): F {
  const t = x
    .sub(a)
    .div(b - a)
    .clamp(0, 1);
  return c === 0 && d === 1 ? t : t.mul(d - c).add(c);
}
