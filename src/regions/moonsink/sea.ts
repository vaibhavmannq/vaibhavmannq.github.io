import {
  abs,
  asin,
  atan,
  Break,
  cameraFar,
  cameraNear,
  cameraPosition,
  cameraProjectionMatrixInverse,
  cameraWorldMatrix,
  clamp,
  cos,
  dot,
  exp,
  Fn,
  float,
  floor,
  fract,
  If,
  int,
  Loop,
  length,
  max,
  min,
  mix,
  normalize,
  positionLocal,
  pow,
  reflect,
  screenCoordinate,
  screenSize,
  screenUV,
  select,
  sign,
  sin,
  smoothstep,
  sqrt,
  step,
  uniform,
  vec2,
  vec3,
  vec4,
  viewZToPerspectiveDepth,
} from 'three/tsl';
import type { Node } from 'three/webgpu';
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry } from 'three/webgpu';
import { MOON_DIRECTION, MOON_RIGHT_AXIS, MOON_UP_AXIS } from './moonDirection';
import { MILKY_BAND_NORMAL, NEBULA_CENTRE } from './nightSky';

type F = Node<'float'>;
type I = Node<'int'>;
type V2 = Node<'vec2'>;
type V3 = Node<'vec3'>;

// "1 - smoothstep(a, b, x)". The prototype used reversed edges (smoothstep(0.14, 0.0, x)),
// which WGSL does not define, so we write the falling edge explicitly.
const fall = (a: number, b: number, x: F) => smoothstep(a, b, x).oneMinus();

// Wave iteration count: pinned constant for ray-march and shading consistency (spec §5.4, §17 S17).
// Amplitude decays 0.74× per layer, so layer 7 alone is 16.4% of layer 1 and pinning at 6
// discards 10.5% of total wave amplitude. Layers 7–9 run at 1.55–2.61 cycles/unit and are
// sub-pixel at every render scale we ship, so they alias rather than resolve.
const WAVE_ITERATIONS = 6;

// A height below every possible surface: the lowest wave trough is about −0.18 and the shore never
// goes below the water, so a ray point at this height is always under the sea.
const BELOW_LOWEST_WAVE = -0.3;

// Rule for this file: functions with setLayout() are compiled into real shader functions and
// must be PURE. They never read uniforms directly; time and step counts come in as parameters.
// (Reading a uniform inside a layout function breaks WGSL compilation: "struct member not found".)

export function createSea() {
  const uniforms = {
    time: uniform(0),
    marchSteps: uniform(80, 'int'),
    // Tonight's real lunar phase (0 = new, 0.5 = full) and the illumination it produces after
    // the floor is applied (spec §5.4b). Set once at construction in index.ts; never mutated
    // per-frame, so a fixed date/`?moon=` value stays fixed for the whole visit.
    moonPhase: uniform(0),
    moonLight: uniform(1),
  };

  // The prototype used a left-handed camera; Three.js is right-handed. Mirroring X into
  // "sea space" lets every constant below stay identical to the prototype.
  const toSea = (v: V3) => vec3(v.x.negate(), v.y, v.z);
  const MOON = vec3(MOON_DIRECTION[0], MOON_DIRECTION[1], MOON_DIRECTION[2]);

  // Fixed local axes across the moon's disc, perpendicular to the (fixed) MOON direction. They are
  // computed once in moonDirection.ts and baked in as constants, so the terminator below costs two
  // dot()s, not two cross()+normalize()s per pixel. MOON_DISC_R is the angular radius (in the same
  // dot-product units) where the disc's existing soft edge (smoothstep(0.9993, 0.99965, md) below)
  // reaches 0, i.e. sqrt(1 - 0.9993^2) — the terminator is normalized to that same radius so the two
  // edges agree.
  const MOON_RIGHT = vec3(MOON_RIGHT_AXIS[0], MOON_RIGHT_AXIS[1], MOON_RIGHT_AXIS[2]);
  const MOON_UP = vec3(MOON_UP_AXIS[0], MOON_UP_AXIS[1], MOON_UP_AXIS[2]);
  const MOON_DISC_R = 0.03741;
  // Earthshine: the unlit part of the disc is a faint ghost just above the sky behind it. It used to
  // be a flat grey (0.07) added on top, which read as a grey disc (spec §14, night sky).
  const EARTHSHINE = vec3(0.02, 0.024, 0.03);
  const MILKY_BAND = vec3(MILKY_BAND_NORMAL[0], MILKY_BAND_NORMAL[1], MILKY_BAND_NORMAL[2]);

  // Pure (§17 S2): phase comes in as a parameter, never read from the uniform directly.
  // The lit region is the disc intersected with a half-plane whose boundary bows into an
  // ellipse — semi-minor axis k = cos(2*pi*phase) of the disc radius, matching
  // illuminatedFraction's use of the same cosine so the disc's shape and the water's
  // brightness stay in lockstep. cos alone is symmetric about phase 0.5 (a 30% waxing crescent
  // and a 30%-from-full waning gibbous share the same k), so sign(sin(2*pi*phase)) breaks that
  // tie: positive for waxing (0, 0.5) — lights the trailing (+x) limb — negative for waning
  // (0.5, 1) — lights the leading (-x) limb.
  const moonLit = Fn(([rd, phase]: [V3, F]) => {
    const xn = dot(rd, MOON_RIGHT).div(MOON_DISC_R);
    const yn = dot(rd, MOON_UP).div(MOON_DISC_R);
    const k = cos(phase.mul(Math.PI * 2));
    const s = sign(sin(phase.mul(Math.PI * 2)));
    const halfWidth = sqrt(max(float(1).sub(yn.mul(yn)), 0));
    const d = xn.mul(s).sub(k.mul(halfWidth));
    // Ascending edges (-0.08 < 0.08): ok under §17 S3. Soft terminator line, similar softness
    // to the disc's own edge below.
    return smoothstep(-0.08, 0.08, d);
  }).setLayout({
    name: 'moonLit',
    type: 'float',
    inputs: [
      { name: 'rd', type: 'vec3' },
      { name: 'phase', type: 'float' },
    ],
  });

  const hash21 = Fn(([p]: [V2]) => {
    const q = fract(p.mul(vec2(123.34, 456.21))).toVar();
    q.addAssign(dot(q, q.add(45.32)));
    return fract(q.x.mul(q.y));
  }).setLayout({ name: 'hash21', type: 'float', inputs: [{ name: 'p', type: 'vec2' }] });

  const noise2 = Fn(([p]: [V2]) => {
    const i = floor(p);
    const f = fract(p);
    const u = f.mul(f).mul(f.mul(-2).add(3));
    const a = hash21(i);
    const b = hash21(i.add(vec2(1, 0)));
    const c = hash21(i.add(vec2(0, 1)));
    const d = hash21(i.add(vec2(1, 1)));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }).setLayout({ name: 'noise2', type: 'float', inputs: [{ name: 'p', type: 'vec2' }] });

  const waterH = Fn(([p, iters, time]: [V2, I, F]) => {
    const h = float(0).toVar();
    const amp = float(0.16).toVar();
    const freq = float(0.32).toVar();
    const speed = float(0.85).toVar();
    const q = vec2(p).toVar();
    Loop({ start: int(0), end: iters, type: 'int', condition: '<' }, ({ i }) => {
      const ang = sin(float(i).mul(1.73)).mul(0.9);
      const d = vec2(sin(ang), cos(ang));
      const x = dot(q, d).mul(freq).add(time.mul(speed));
      const w = exp(sin(x).sub(1));
      h.addAssign(amp.mul(w));
      q.subAssign(d.mul(w.mul(cos(x)).mul(amp).mul(0.55)));
      amp.mulAssign(0.74);
      freq.mulAssign(1.3);
      speed.mulAssign(1.06);
    });
    h.addAssign(sin(time.mul(0.55).sub(p.y.mul(0.35))).mul(0.1));
    return h.sub(0.16);
  }).setLayout({
    name: 'waterH',
    type: 'float',
    inputs: [
      { name: 'p', type: 'vec2' },
      { name: 'iters', type: 'int' },
      { name: 'time', type: 'float' },
    ],
  });

  const sandH = Fn(([p]: [V2]) => {
    const s = p.y.mul(-0.07).sub(0.12).toVar();
    s.addAssign(
      sin(p.x.mul(0.23).add(sin(p.y.mul(0.4))))
        .mul(0.12)
        .mul(smoothstep(0, 6, p.y.negate())),
    );
    s.addAssign(noise2(p.mul(1.3)).sub(0.5).mul(0.05));
    return min(s, 2.2);
  }).setLayout({ name: 'sandH', type: 'float', inputs: [{ name: 'p', type: 'vec2' }] });

  const heightAt = Fn(([p, time]: [V2, F]) => max(waterH(p, int(WAVE_ITERATIONS), time), sandH(p))).setLayout({
    name: 'heightAt',
    type: 'float',
    inputs: [
      { name: 'p', type: 'vec2' },
      { name: 'time', type: 'float' },
    ],
  });

  // ---- Night sky (owner request, 2026-09-14; spec §17 S28) ----
  // Every detail is tied to a world direction and the camera's view never turns (§17 S27), so the sky
  // holds still on screen; stars only twinkle in place. It is the same at every tier (§5.6).

  const fbm = Fn(([p]: [V2]) => {
    const sum = float(0).toVar();
    const q = vec2(p).toVar();
    const amp = float(0.5).toVar();
    Loop({ start: int(0), end: int(4), type: 'int', condition: '<' }, () => {
      sum.addAssign(amp.mul(noise2(q)));
      q.assign(q.mul(2.03).add(vec2(1.7, 9.2)));
      amp.mulAssign(0.5);
    });
    return sum;
  }).setLayout({ name: 'fbm', type: 'float', inputs: [{ name: 'p', type: 'vec2' }] });

  // One layer of stars on a grid over the sky map: mostly faint, a few bright. A star is never drawn
  // thinner than a pixel (pxCells is one pixel in grid cells), so it cannot shimmer at low render scales.
  const starLayer = Fn(([sp, density, size, brightness, pxCells, time]: [V2, F, F, F, F, F]) => {
    const cell = floor(sp);
    const h = hash21(cell);
    const offset = vec2(hash21(cell.add(5.3)), hash21(cell.add(9.1)))
      .sub(0.5)
      .mul(0.7);
    const d = length(fract(sp).sub(0.5).sub(offset));
    const r = max(size, pxCells.mul(0.8));
    const core = exp(d.mul(d).div(r.mul(r)).negate()).mul(size.mul(size).div(r.mul(r)));
    const magnitude = pow(hash21(cell.add(1.7)), 3)
      .mul(0.85)
      .add(0.15);
    const twinkle = sin(time.mul(hash21(cell.add(3.3)).mul(2).add(0.8)).add(h.mul(80)))
      .mul(0.2)
      .add(0.8);
    const tint = mix(vec3(0.72, 0.84, 1.0), vec3(1.0, 0.9, 0.76), hash21(cell.add(7.7)));
    return tint.mul(step(h, density).mul(core).mul(magnitude).mul(brightness).mul(twinkle));
  }).setLayout({
    name: 'starLayer',
    type: 'vec3',
    inputs: [
      { name: 'sp', type: 'vec2' },
      { name: 'density', type: 'float' },
      { name: 'size', type: 'float' },
      { name: 'brightness', type: 'float' },
      { name: 'pxCells', type: 'float' },
      { name: 'time', type: 'float' },
    ],
  });

  const nightSky = Fn(([rd, time, phase, pxAngle]: [V3, F, F, F]) => {
    const c = vec3(0).toVar();
    const azimuth = atan(rd.x, rd.z);
    const elevation = asin(clamp(rd.y, -1, 1));
    const p = vec2(azimuth, elevation).toVar();
    const sp = vec2(azimuth.mul(cos(elevation)), elevation).toVar();
    const md = max(dot(rd, MOON), 0);
    // Darker nights show more: 0 at full moon, 1 at new moon.
    const dark = cos(phase.mul(Math.PI * 2))
      .mul(0.5)
      .add(0.5);
    const haze = smoothstep(0.01, 0.12, elevation);
    const nearMoon = smoothstep(0.97, 0.9985, md).mul(0.9).oneMinus();

    // Milky band: a soft great circle left of the moon, with dark dust lanes.
    const bandDistance = dot(rd, MILKY_BAND);
    const band = exp(bandDistance.mul(bandDistance).div(0.01).negate()).toVar();
    If(band.greaterThan(0.01), () => {
      const body = fbm(p.mul(7).add(2)).mul(0.5).add(0.5);
      const dust = smoothstep(0.48, 0.72, fbm(p.mul(16).add(vec2(3.1, 7.4))));
      const bandGain = band
        .mul(body)
        .mul(dust.mul(0.7).oneMinus())
        .mul(haze)
        .mul(mix(float(0.6), float(1.3), dark));
      c.addAssign(vec3(0.03, 0.045, 0.06).mul(bandGain));
    });

    // Nebula: a faint, domain-warped cloud above and left of the moon.
    const q = p.sub(vec2(NEBULA_CENTRE[0], NEBULA_CENTRE[1])).mul(vec2(1, 1.25));
    const falloff = exp(dot(q, q).div(0.028).negate()).toVar();
    If(falloff.greaterThan(0.02), () => {
      const warp = vec2(fbm(p.mul(6)), fbm(p.mul(6).add(5.2)));
      const cloud = fbm(p.mul(5).add(warp.mul(1.6)));
      const tint = mix(
        vec3(0.02, 0.075, 0.085),
        vec3(0.07, 0.035, 0.09),
        smoothstep(0.35, 0.75, fbm(p.mul(3).add(11))),
      );
      c.addAssign(
        tint.mul(
          falloff
            .mul(smoothstep(0.38, 0.9, cloud))
            .mul(haze)
            .mul(mix(float(0.55), float(1.25), dark)),
        ),
      );
    });

    // Three layers of stars at the owner's pick, "many" (the look-demo values); the faintest layer
    // thickens inside the band.
    const starGain = mix(float(0.65), float(1.3), dark).mul(haze).mul(nearMoon);
    const stars = starLayer(sp.mul(70), float(0.07), float(0.07), float(2.2), pxAngle.mul(70), time)
      .add(starLayer(sp.mul(160).add(13), float(0.13), float(0.06), float(0.9), pxAngle.mul(160), time))
      .add(starLayer(sp.mul(360).add(41), band.mul(0.4).add(0.28), float(0.05), float(0.4), pxAngle.mul(360), time));
    c.addAssign(stars.mul(starGain));
    return c;
  }).setLayout({
    name: 'nightSky',
    type: 'vec3',
    inputs: [
      { name: 'rd', type: 'vec3' },
      { name: 'time', type: 'float' },
      { name: 'phase', type: 'float' },
      { name: 'pxAngle', type: 'float' },
    ],
  });

  const sky = Fn(([rd, detail, time, phase, light, pxAngle]: [V3, F, F, F, F, F]) => {
    const y = max(rd.y, 0);
    const facing = dot(normalize(rd.xz.add(1e-4)), normalize(MOON.xz));
    const hor = mix(vec3(0.004, 0.007, 0.01), vec3(0.035, 0.06, 0.07), smoothstep(-0.7, 1.0, facing));
    const c = mix(hor, vec3(0.0005, 0.001, 0.003), pow(y, 0.3)).toVar();
    const md = max(dot(rd, MOON), 0);
    // Sky glow near the moon: scales with moonLight (spec §5.4b Step 5), not with the stars.
    c.addAssign(vec3(0.35, 0.6, 0.66).mul(pow(md, 40).mul(0.3)).mul(light));
    c.addAssign(vec3(0.1, 0.25, 0.3).mul(pow(md, 6).mul(0.05)).mul(light));
    // Reflections and fog pass detail 0: they show only the glow, and the GPU skips the sky's detail.
    If(detail.greaterThan(0.5), () => {
      c.addAssign(nightSky(rd, time, phase, pxAngle));
    });
    // The moon disc covers whatever is behind it. Its lit part follows the terminator, not `light`:
    // the lit limb is always full brightness and only the lit *amount* changes with phase (§5.4b).
    const discShape = smoothstep(0.9993, 0.99965, md);
    const lit = moonLit(rd, phase);
    const unlitSide = c.mul(0.85).add(EARTHSHINE);
    const litSide = vec3(1.0, 0.97, 0.88).mul(2.5).add(c.mul(0.25));
    c.assign(mix(c, mix(unlitSide, litSide, lit), discShape));
    return c;
  }).setLayout({
    name: 'sky',
    type: 'vec3',
    inputs: [
      { name: 'rd', type: 'vec3' },
      { name: 'detail', type: 'float' },
      { name: 'time', type: 'float' },
      { name: 'phase', type: 'float' },
      { name: 'light', type: 'float' },
      { name: 'pxAngle', type: 'float' },
    ],
  });

  // Sphere-trace the height field. On overshoot we stop, then refine with a short
  // bisection *after* the loop (no nested loops, which keeps the shader simple).
  const march = Fn(([ro, rd, steps, time]: [V3, V3, I, F]) => {
    const t = float(0.05).toVar();
    const tPrev = float(0.05).toVar();
    const hit = float(-1).toVar();
    const overshot = float(0).toVar();
    Loop({ start: int(0), end: steps, type: 'int', condition: '<' }, () => {
      const p = ro.add(rd.mul(t)).toVar();
      If(p.y.greaterThan(2.4).and(rd.y.greaterThan(0)), () => {
        Break();
      });
      const d = p.y.sub(heightAt(p.xz, time)).toVar();
      If(d.lessThan(0), () => {
        overshot.assign(1);
        Break();
      });
      If(d.lessThan(t.mul(0.002)), () => {
        hit.assign(t);
        Break();
      });
      tPrev.assign(t);
      t.addAssign(max(d.mul(0.5), t.mul(0.006).add(0.012)));
      If(t.greaterThan(240), () => {
        Break();
      });
    });
    // A ray still heading down when the steps run out has not reached the water yet. Near the shore the
    // camera is low, and rays skimming the sea creep toward it in ever smaller steps, so every tier ran
    // out and the sky showed through as a streak below the horizon (spec §17 S29). Treat the point where
    // the ray passes below the lowest wave as an overshoot, so the bisection below finds the surface.
    If(hit.lessThan(0).and(overshot.lessThan(0.5)).and(rd.y.lessThan(0)), () => {
      t.assign(max(t, ro.y.sub(BELOW_LOWEST_WAVE).div(rd.y.negate())));
      overshot.assign(1);
    });
    If(overshot.greaterThan(0.5), () => {
      const a = tPrev.toVar();
      const b = t.toVar();
      Loop({ start: int(0), end: int(6), type: 'int', condition: '<' }, () => {
        const m = a.add(b).mul(0.5).toVar();
        const pm = ro.add(rd.mul(m));
        If(pm.y.sub(heightAt(pm.xz, time)).lessThan(0), () => {
          b.assign(m);
        }).Else(() => {
          a.assign(m);
        });
      });
      hit.assign(b);
    });
    return hit;
  }).setLayout({
    name: 'march',
    type: 'float',
    inputs: [
      { name: 'ro', type: 'vec3' },
      { name: 'rd', type: 'vec3' },
      { name: 'steps', type: 'int' },
      { name: 'time', type: 'float' },
    ],
  });

  // Uniforms are read ONLY here, in the main shader body, then passed into the pure functions.
  const time = uniforms.time.toVar('seaTime');
  const moonPhaseVar = uniforms.moonPhase.toVar('seaMoonPhase');
  const moonLightVar = uniforms.moonLight.toVar('seaMoonLight');

  // Camera ray for this pixel, built from the real Three.js camera (screenUV origin is top-left)
  const ndc = vec2(screenUV.x.mul(2).sub(1), screenUV.y.mul(2).sub(1).negate());
  const viewPos = cameraProjectionMatrixInverse.mul(vec4(ndc, 0.5, 1));
  const dirView = normalize(viewPos.xyz.div(viewPos.w)).toVar('seaDirView');
  // Angle covered by one pixel, so stars are never drawn thinner than a pixel. Measured against the
  // next pixel's ray here, because derivatives (fwidth) are not allowed inside the branch that draws
  // the sky: that branch depends on the ray march.
  const ndcNext = vec2(ndc.x, ndc.y.add(float(2).div(screenSize.y)));
  const viewPosNext = cameraProjectionMatrixInverse.mul(vec4(ndcNext, 0.5, 1));
  const pxAngle = length(normalize(viewPosNext.xyz.div(viewPosNext.w)).sub(dirView)).toVar('seaPxAngle');
  const dirWorld = normalize(cameraWorldMatrix.mul(vec4(dirView, 0)).xyz);
  const ro = toSea(cameraPosition).toVar('seaRo');
  const rd = toSea(dirWorld).toVar('seaRd');
  const tHit = march(ro, rd, uniforms.marchSteps, time).toVar('seaT');

  const color = Fn(() => {
    const col = vec3(0).toVar();
    If(tHit.lessThan(0), () => {
      col.assign(sky(rd, float(1), time, moonPhaseVar, moonLightVar, pxAngle));
    }).Else(() => {
      const detail = int(WAVE_ITERATIONS);
      const p = ro.add(rd.mul(tHit)).toVar();
      const wH = waterH(p.xz, detail, time).toVar();
      const sH = sandH(p.xz).toVar();
      const e = max(tHit.mul(0.0025), 0.012).toVar();
      const isWater = wH.greaterThanEqual(sH);
      const ex = vec2(e, 0);
      const ez = vec2(0, e);
      const hx1 = select(isWater, waterH(p.xz.sub(ex), detail, time), sandH(p.xz.sub(ex)));
      const hx2 = select(isWater, waterH(p.xz.add(ex), detail, time), sandH(p.xz.add(ex)));
      const hz1 = select(isWater, waterH(p.xz.sub(ez), detail, time), sandH(p.xz.sub(ez)));
      const hz2 = select(isWater, waterH(p.xz.add(ez), detail, time), sandH(p.xz.add(ez)));
      const n = normalize(vec3(hx1.sub(hx2), e.mul(2), hz1.sub(hz2))).toVar();
      const R = reflect(rd, n).toVar();
      R.y.assign(abs(R.y));
      const fres = pow(max(dot(n, rd.negate()), 0).oneMinus(), 5)
        .mul(0.97)
        .add(0.03);
      const skyR = sky(R, float(0), time, moonPhaseVar, moonLightVar, pxAngle).toVar();

      // Water: deep colour + faint crest scatter, mirrored sky, moon glitter, shoreline foam
      const crest = smoothstep(-0.05, 0.35, p.y);
      const scatter = crest.mul(max(dot(MOON.xz, rd.xz.negate()), 0).mul(0.6).add(0.4));
      const water = mix(vec3(0.001, 0.006, 0.01).add(vec3(0.002, 0.025, 0.028).mul(scatter)), skyR, fres).toVar();
      // Specular moon path: scales with moonLight (spec §5.4b Step 5).
      water.addAssign(
        vec3(1.0, 0.96, 0.88)
          .mul(pow(max(dot(R, MOON), 0), 300).mul(2.2))
          .mul(moonLightVar),
      );
      const foamNoise = noise2(p.xz.mul(vec2(2.5, 5.0)).add(vec2(0, time.mul(0.5))));
      const foam = fall(0.0, 0.14, wH.sub(sH)).mul(foamNoise.mul(0.55).add(0.45));
      water.assign(mix(water, vec3(0.3, 0.4, 0.42), foam.mul(0.7)));

      // Black sand: barely-lit base, wet sheen near the waterline, rare glints
      const sand = vec3(0.004, 0.004, 0.005)
        .mul(max(dot(n, MOON), 0).add(0.3))
        .add(vec3(0.004, 0.012, 0.016))
        .toVar();
      const wet = fall(0.0, 0.35, sH.sub(wH));
      sand.assign(mix(sand, skyR.mul(fres.mul(0.8)).add(vec3(0.002, 0.006, 0.008)), wet));
      sand.addAssign(vec3(0.55, 0.68, 0.7).mul(fall(0.0, 0.05, sH.sub(wH)).mul(0.25)));
      const gh = hash21(floor(p.xz.mul(50)));
      const glint = step(0.985, gh)
        .mul(pow(max(dot(R, MOON), 0), 5))
        .mul(
          sin(time.mul(3).add(gh.mul(80)))
            .mul(0.5)
            .add(0.5),
        )
        .mul(fall(2.0, 25.0, tHit))
        .mul(1.4);
      // Glitter: scales with moonLight (spec §5.4b Step 5).
      sand.addAssign(vec3(0.75, 0.95, 1.0).mul(glint).mul(moonLightVar));

      col.assign(select(isWater, water, sand));
      const fogColor = sky(normalize(vec3(rd.x, 0.015, rd.z)), float(0), time, moonPhaseVar, moonLightVar, pxAngle);
      col.assign(mix(col, fogColor, exp(tHit.mul(-0.022)).oneMinus()));
    });

    // Drifting motes in screen space. They drift with time only, never with the camera, so the sky
    // holds still while the visitor scrolls (owner, 2026-09-14).
    const uv = screenCoordinate.sub(screenSize.mul(0.5)).div(screenSize.y).toVar();
    const motes = float(0).toVar();
    Loop({ start: int(0), end: int(3), type: 'int', condition: '<' }, ({ i }) => {
      const fi = float(i);
      const drift = vec2(0, time.mul(fi.mul(0.02).add(0.04)).negate());
      const g = uv.mul(fi.mul(4).add(5)).add(drift);
      const id = floor(g);
      const fr = fract(g).sub(0.5);
      const h = hash21(id.add(fi.mul(17)));
      const wobble = vec2(sin(time.mul(0.6).add(h.mul(40))), cos(time.mul(0.5).add(h.mul(30)))).mul(0.15);
      const o = vec2(hash21(id.add(3.1)), hash21(id.add(7.7)))
        .sub(0.5)
        .add(wobble);
      const dist = length(fr.sub(o.mul(0.7)));
      const pulse = sin(time.mul(1.3).add(h.mul(60)))
        .mul(0.5)
        .add(0.5);
      motes.addAssign(
        step(0.8, h)
          .mul(fall(0.0, 0.06, dist))
          .mul(pulse)
          .mul(fi.mul(-0.15).add(0.6)),
      );
    });
    col.addAssign(vec3(0.55, 0.88, 0.95).mul(motes.mul(0.35)));

    // Prototype tone curve. The pipeline's output transform then applies sRGB (~pow 1/2.2),
    // so raising to 0.62 * 2.2 = 1.364 lands on the prototype's final brightness.
    col.assign(pow(exp(col.mul(-1.4)).oneMinus(), vec3(1.364)));
    col.mulAssign(mix(0.55, 1.0, fall(0.35, 1.25, length(uv))));
    col.addAssign(
      hash21(screenCoordinate.add(fract(time).mul(100)))
        .sub(0.5)
        .mul(0.006),
    );
    return vec4(col, 1);
  })();

  // Depth of the water/sand hit, so 3D objects sink into the sea correctly
  const depth = select(tHit.lessThan(0), float(1), viewZToPerspectiveDepth(dirView.z.mul(tHit), cameraNear, cameraFar));

  const material = new MeshBasicNodeMaterial();
  material.vertexNode = vec4(positionLocal.xy, 0, 1);
  material.colorNode = color;
  material.depthNode = depth;

  const mesh = new Mesh(new PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;

  return { mesh, uniforms };
}

export type Sea = ReturnType<typeof createSea>;
export type SeaUniforms = Sea['uniforms'];
