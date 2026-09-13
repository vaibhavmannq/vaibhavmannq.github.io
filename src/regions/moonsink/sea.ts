import {
  abs,
  atan,
  Break,
  cameraFar,
  cameraNear,
  cameraPosition,
  cameraProjectionMatrixInverse,
  cameraWorldMatrix,
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
  sin,
  smoothstep,
  step,
  uniform,
  vec2,
  vec3,
  vec4,
  viewZToPerspectiveDepth,
} from 'three/tsl';
import type { Node } from 'three/webgpu';
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry } from 'three/webgpu';

type F = Node<'float'>;
type I = Node<'int'>;
type V2 = Node<'vec2'>;
type V3 = Node<'vec3'>;

// "1 - smoothstep(a, b, x)". The prototype used reversed edges (smoothstep(0.14, 0.0, x)),
// which WGSL does not define, so we write the falling edge explicitly.
const fall = (a: number, b: number, x: F) => smoothstep(a, b, x).oneMinus();

// Rule for this file: functions with setLayout() are compiled into real shader functions and
// must be PURE. They never read uniforms directly; time and step counts come in as parameters.
// (Reading a uniform inside a layout function breaks WGSL compilation: "struct member not found".)

export function createSea() {
  const uniforms = {
    time: uniform(0),
    yaw: uniform(0),
    marchSteps: uniform(80, 'int'),
    waveDetail: uniform(9, 'int'),
  };

  // The prototype used a left-handed camera; Three.js is right-handed. Mirroring X into
  // "sea space" lets every constant below stay identical to the prototype.
  const toSea = (v: V3) => vec3(v.x.negate(), v.y, v.z);
  const MOON = vec3(0.148, 0.0691, 0.9866);

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

  const heightAt = Fn(([p, time]: [V2, F]) => max(waterH(p, int(5), time), sandH(p))).setLayout({
    name: 'heightAt',
    type: 'float',
    inputs: [
      { name: 'p', type: 'vec2' },
      { name: 'time', type: 'float' },
    ],
  });

  const sky = Fn(([rd, stars, time]: [V3, F, F]) => {
    const y = max(rd.y, 0);
    const facing = dot(normalize(rd.xz.add(1e-4)), normalize(MOON.xz));
    const hor = mix(vec3(0.004, 0.007, 0.01), vec3(0.035, 0.06, 0.07), smoothstep(-0.7, 1.0, facing));
    const c = mix(hor, vec3(0.0005, 0.001, 0.003), pow(y, 0.3)).toVar();
    const md = max(dot(rd, MOON), 0);
    c.addAssign(vec3(1.0, 0.97, 0.88).mul(smoothstep(0.9993, 0.99965, md).mul(2.5)));
    c.addAssign(vec3(0.35, 0.6, 0.66).mul(pow(md, 40).mul(0.3)));
    c.addAssign(vec3(0.1, 0.25, 0.3).mul(pow(md, 6).mul(0.05)));
    const sp = vec2(atan(rd.x, rd.z), rd.y).mul(90);
    const cell = floor(sp);
    const st = hash21(cell);
    const offset = vec2(hash21(cell.add(5.3)), hash21(cell.add(9.1)))
      .sub(0.5)
      .mul(0.6);
    const sd = length(fract(sp).sub(0.5).sub(offset));
    const twinkle = sin(time.mul(1.7).add(st.mul(90)))
      .mul(0.5)
      .add(0.5);
    const starAmount = stars
      .mul(step(0.985, st))
      .mul(fall(0.0, 0.09, sd))
      .mul(smoothstep(0.04, 0.35, rd.y))
      .mul(twinkle)
      .mul(1.5);
    c.addAssign(vec3(0.7, 0.9, 1.0).mul(starAmount));
    const band = noise2(vec2(rd.x.mul(2.5).add(time.mul(0.015)), rd.y.mul(7).sub(time.mul(0.01))));
    const bandAmount = pow(band, 5)
      .mul(smoothstep(0.06, 0.35, y))
      .mul(fall(0.35, 0.85, y))
      .mul(0.7);
    c.addAssign(vec3(0.04, 0.22, 0.25).mul(bandAmount));
    return c;
  }).setLayout({
    name: 'sky',
    type: 'vec3',
    inputs: [
      { name: 'rd', type: 'vec3' },
      { name: 'stars', type: 'float' },
      { name: 'time', type: 'float' },
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

  // Camera ray for this pixel, built from the real Three.js camera (screenUV origin is top-left)
  const ndc = vec2(screenUV.x.mul(2).sub(1), screenUV.y.mul(2).sub(1).negate());
  const viewPos = cameraProjectionMatrixInverse.mul(vec4(ndc, 0.5, 1));
  const dirView = normalize(viewPos.xyz.div(viewPos.w)).toVar('seaDirView');
  const dirWorld = normalize(cameraWorldMatrix.mul(vec4(dirView, 0)).xyz);
  const ro = toSea(cameraPosition).toVar('seaRo');
  const rd = toSea(dirWorld).toVar('seaRd');
  const tHit = march(ro, rd, uniforms.marchSteps, time).toVar('seaT');

  const color = Fn(() => {
    const col = vec3(0).toVar();
    If(tHit.lessThan(0), () => {
      col.assign(sky(rd, float(1), time));
    }).Else(() => {
      const detail = uniforms.waveDetail;
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
      const skyR = sky(R, float(0), time).toVar();

      // Water: deep colour + faint crest scatter, mirrored sky, moon glitter, shoreline foam
      const crest = smoothstep(-0.05, 0.35, p.y);
      const scatter = crest.mul(max(dot(MOON.xz, rd.xz.negate()), 0).mul(0.6).add(0.4));
      const water = mix(vec3(0.001, 0.006, 0.01).add(vec3(0.002, 0.025, 0.028).mul(scatter)), skyR, fres).toVar();
      water.addAssign(vec3(1.0, 0.96, 0.88).mul(pow(max(dot(R, MOON), 0), 300).mul(2.2)));
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
      sand.addAssign(vec3(0.75, 0.95, 1.0).mul(glint));

      col.assign(select(isWater, water, sand));
      const fogColor = sky(normalize(vec3(rd.x, 0.015, rd.z)), float(0), time);
      col.assign(mix(col, fogColor, exp(tHit.mul(-0.022)).oneMinus()));
    });

    // Drifting motes in screen space, with parallax from yaw and camera height
    const uv = screenCoordinate.sub(screenSize.mul(0.5)).div(screenSize.y).toVar();
    const motes = float(0).toVar();
    Loop({ start: int(0), end: int(3), type: 'int', condition: '<' }, ({ i }) => {
      const fi = float(i);
      const drift = vec2(
        uniforms.yaw.mul(fi.add(1.5)).mul(2),
        time.mul(fi.mul(0.02).add(0.04)).negate().add(cameraPosition.y.mul(0.15)),
      );
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
