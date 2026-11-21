import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import {
  acesFilmicToneMapping,
  dot,
  float,
  max,
  min,
  pass,
  saturation,
  screenSize,
  screenUV,
  smoothstep,
  sRGBTransferOETF,
  uniform,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import {
  type Camera,
  type Node,
  NoToneMapping,
  type Object3D,
  RenderPipeline,
  type Scene,
  WebGPURenderer,
} from 'three/webgpu';
import type { LightUniforms } from '../world/light';
import type { Mirror } from '../world/sea';

/** The brightest a pixel may feed the bloom, scene-linear (s22: Golden's and Blue hour's glare). */
export const BLOOM_CAP = 3;

/** The two settings the pipeline itself changes (the tier table lives in quality/tiers.ts). */
export interface PipelineTier {
  scale: number;
  bloom: boolean;
}

export interface Pipeline {
  readonly renderer: WebGPURenderer;
  readonly backend: 'webgpu' | 'webgl2';
  setScene(scene: Scene, camera: Camera, light: LightUniforms): void;
  setTier(t: PipelineTier, devicePixelRatio: number): void;
  resize(width: number, height: number): void;
  render(): void;
  /** Compile every shader and render each output once, while the canvas is still hidden. */
  warmUp(): Promise<void>;
  /**
   * Build `object`'s shaders for where it is really drawn: the scene pass. A bare compileAsync builds them for the canvas at the top level, which three.js r186 keys apart (a material's
   * build is keyed by its render context, and a context by its target and how deeply nested its render call is), so
   * a part that first showed mid-flight (the aurora, the cloud deck) was built again then: 0.7-0.8 s frames on the
   * laptop (s12 trace).
   */
  compile(object: Object3D, opts?: { mirror?: boolean }): Promise<void>;
  /** The sea's mirror: from now on `compile` also builds each part for it (R38, plan M6). */
  setMirror(mirror: Mirror | null): void;
}

/** Throws if neither WebGPU nor WebGL2 is available; boot shows the stills instead. */
/**
 * The upscaler (M8.5 #17, s24). Below full size the canvas used to shrink with the tier and the browser stretched it:
 * every edge and the text-sharp detail blurred together. Now the canvas stays full size, only the scene pass draws
 * smaller, and the last pass upscales it with a contrast-adaptive sharpen (after AMD's CAS: five taps, a weight from the
 * local contrast, so flat sky stays smooth and edges get their crispness back). `up` and `sharp` are the switches.
 */
export interface Upscale {
  up: boolean;
  /** 0 (none) .. 1 (strongest). */
  sharp: number;
}

export async function createPipeline(
  host: HTMLElement,
  forceWebGL: boolean,
  gpuTimer = false,
  upscale: Upscale = { up: false, sharp: 0.5 },
): Promise<Pipeline> {
  const renderer = new WebGPURenderer({
    antialias: false,
    forceWebGL,
    // `?gpu`: the GPU's own time per frame, for the cost table (plan M2 Task 7); off for visitors.
    trackTimestamp: gpuTimer,
    // Opaque: every pixel is drawn, and the compositor need not blend the page under it.
    alpha: false,
  });
  await renderer.init();
  keyBuildsByOwnContext(renderer);
  renderer.toneMapping = NoToneMapping;
  // The host is sized to the large viewport (world.css), which a phone's toolbar never changes.
  renderer.setSize(host.clientWidth, host.clientHeight);
  host.append(renderer.domElement);
  const backend = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend === true ? 'webgpu' : 'webgl2';
  const pipeline = new RenderPipeline(renderer);
  pipeline.outputColorTransform = false;

  let plain: Node<'vec4'> | null = null;
  let glow: Node<'vec4'> | null = null;
  let bloomOn = false;
  let view: { scene: Scene; camera: Camera } | null = null;
  let scenePass: ReturnType<typeof pass> | null = null;
  let mirror: Mirror | null = null;
  // the scene pass's share of the canvas (1 when not upscaling), and the bloom kept at its old cost
  const sceneScale = uniform(1);
  let bloomNode: ReturnType<typeof bloom> | null = null;
  const applyScale = () => {
    scenePass?.setResolutionScale(sceneScale.value);
    bloomNode?.setResolutionScale(0.5 * sceneScale.value);
  };
  const select = () => {
    const next = bloomOn ? glow : plain;
    if (!next) return;
    pipeline.outputNode = next;
    pipeline.needsUpdate = true;
  };

  return {
    renderer,
    backend,
    setScene(scene, camera, light) {
      view = { scene, camera };
      scenePass = pass(scene, camera);
      const raw = scenePass.getTextureNode('output');
      applyScale();
      // the contrast-adaptive sharpen, in the scene's own texels; the weight comes from brightness so colours keep
      const texel = vec2(1).div(screenSize.mul(sceneScale));
      const tap = (x: number, y: number) => raw.sample(screenUV.add(vec2(x, y).mul(texel))).rgb as Node<'vec3'>;
      const c = raw.sample(screenUV).rgb as Node<'vec3'>;
      const [n, w, e, so] = [tap(0, -1), tap(-1, 0), tap(1, 0), tap(0, 1)];
      const luma = (v: Node<'vec3'>) => {
        const l = dot(v, vec3(0.2126, 0.7152, 0.0722));
        return l.div(l.add(1)); // compressed, as CAS expects 0..1
      };
      const [lc, ln, lw, le, ls] = [luma(c), luma(n), luma(w), luma(e), luma(so)];
      const mn = min(lc, min(min(ln, lw), min(le, ls)));
      const mx = max(lc, max(max(ln, lw), max(le, ls)));
      const amp = min(mn, float(1).sub(mx)).div(mx.add(1e-4)).clamp(0, 1).sqrt();
      const wgt = amp.mul(float(-1).div(float(8).sub(float(3).mul(upscale.sharp))));
      const sharpened = max(c.add(n.add(w).add(e).add(so).mul(wgt)).div(wgt.mul(4).add(1)), vec3(0));
      const color = (upscale.up ? vec4(sharpened, 1) : raw) as unknown as typeof raw;
      // The renders' vivid grade (grade.py, as in the slice): ACES, saturation 1.32, a warm tint, a soft vignette.
      const grade = (c: Node<'vec4'>): Node<'vec4'> => {
        let g = acesFilmicToneMapping(c.rgb, light.exposure) as Node<'vec3'>;
        g = (saturation(g, 1.32) as Node<'vec3'>).mul(vec3(1.03, 1.0, 0.98)).clamp(0, 1);
        const q = screenUV
          .sub(0.5)
          .mul(vec2(screenSize.x.div(screenSize.y), 1))
          .length();
        g = g.mul(float(1).sub(smoothstep(0.45, 1.15, q).pow(1.6).mul(0.24)));
        // The shadow floor (plan M2.5 Task 4; owner-references §17): the darkest pixels lift to the hour's tinted floor
        // and anything 4× brighter than it is untouched; the lift's slope stays under 1, so the order of tones holds.
        const lum = (c: Node<'vec3'>) => dot(c, vec3(0.2126, 0.7152, 0.0722));
        const floor = light.shadowFloor as unknown as Node<'vec3'>;
        g = g.add(floor.mul(float(1).sub(smoothstep(0, lum(floor).mul(4), lum(g)))));
        return vec4(sRGBTransferOETF(g) as Node<'vec3'>, 1);
      };
      plain = grade(color as unknown as Node<'vec4'>);
      // The glow is fed light capped at BLOOM_CAP (plan M8 Task 7, s22): the sun's road on the water reaches tens of
      // units, and uncapped its bloom spread a white haze over Golden's near sand and lantern and a hot patch at Blue
      // hour's arch (the renders show a compact sun and its reflection). Lanterns, falls and fireflies sit under it.
      const capped = vec4((color as unknown as Node<'vec4'>).rgb.min(BLOOM_CAP), 1) as unknown as typeof color;
      bloomNode = bloom(capped, 0.22, 0.45, 1.6);
      applyScale();
      glow = grade(color.add(bloomNode) as Node<'vec4'>);
      select();
    },
    setTier(t, devicePixelRatio) {
      // upscaling below full size: the canvas at full size, the scene pass at the tier's share of it
      const up = upscale.up && t.scale < 1;
      renderer.setPixelRatio(devicePixelRatio * (up ? 1 : t.scale));
      sceneScale.value = up ? t.scale : 1;
      applyScale();
      if (t.bloom !== bloomOn) {
        bloomOn = t.bloom;
        select();
      }
    },
    resize(width, height) {
      renderer.setSize(width, height);
    },
    render() {
      pipeline.render();
    },
    setMirror(m) {
      mirror = m;
    },
    async compile(object, opts) {
      const target = scenePass?.renderTarget;
      if (!view || !target) return;
      // compileAsync picks its render context before its first await, at nesting depth 0, but the scene pass draws at
      // depth 1 and the sea's mirror inside it at depth 2; so the target and the depth are set only around each call.
      // r186 internals: Renderer._renderContexts.get(target, mrt, callDepth).
      const contexts = (renderer as unknown as { _renderContexts?: { get?: (...a: unknown[]) => unknown } })
        ._renderContexts;
      const get = contexts?.get;
      // another three.js version: the plain compile (a first-use hitch, never a part left out)
      if (!contexts || typeof get !== 'function') return renderer.compileAsync(object, view.camera, view.scene);
      const at = (depth: number, rt: typeof target, camera: Camera) => {
        const previous = renderer.getRenderTarget();
        contexts.get = (r: unknown, m: unknown) => get.call(contexts, r, m, depth);
        renderer.setRenderTarget(rt);
        try {
          return renderer.compileAsync(object, camera, (view as { scene: Scene }).scene);
        } finally {
          contexts.get = get;
          renderer.setRenderTarget(previous);
        }
      };
      const eye = view.camera;
      // Culling is off for both calls, so everything the part holds is built wherever the eye is: the eye's own call
      // culled by the current view, so a part out of view when it joined (the spots' glints, opening at Midnight)
      // built on its first trip, mid-flight (R121, plan M8 Task 1).
      const culled: Object3D[] = [];
      object.traverse((o) => {
        if (o.frustumCulled) {
          culled.push(o);
          o.frustumCulled = false;
        }
      });
      const builds: Promise<unknown>[] = [];
      try {
        builds.push(at(1, target, eye));
        // R38 (plan M6): the mirror's first draw of a part (the aurora, the cloud deck, the cave) built its shaders
        // mid-flight: 0.45-1.1 s on this laptop with no shader cache, 0.15-0.2 s on the phone. Its camera is a clone
        // whose matrices are last frame's reflection. This needs keyBuildsByOwnContext (below): without it the eye's
        // parts drew with the mirror's camera (s12).
        if (mirror && opts?.mirror !== false) builds.push(at(2, mirror.target(eye), mirror.camera(eye)));
      } finally {
        for (const o of culled) o.frustumCulled = true;
      }
      await Promise.all(builds);
    },
    async warmUp() {
      if (!view) return;
      await renderer.compileAsync(view.scene, view.camera);
      const wanted = bloomOn;
      for (const b of [false, true]) {
        bloomOn = b;
        select();
        pipeline.render();
      }
      bloomOn = wanted;
      select();
    },
  };
}

/**
 * R38 (plan M6). three.js r186 shares a shader's camera uniforms ("render" group) between every build made under the
 * same `renderer._currentRenderContext` (NodeBuilder._getBindGroup). A real draw builds with its own context set; a
 * compileAsync builds after the call has returned, with no context, so the eye's and the mirror's pre-built parts got
 * one camera buffer, and the mirror's camera, written last, drew the eye's view upside down (s12, s19). Each build is
 * keyed by its own render object's context, as a real draw would key it.
 */
export function keyBuildsByOwnContext(renderer: WebGPURenderer): void {
  const r = renderer as unknown as {
    _currentRenderContext: unknown;
    debug: { onNodeBuilderCreated: ((builder: unknown, renderObject: unknown) => void) | null };
  };
  const previous = r.debug.onNodeBuilderCreated;
  r.debug.onNodeBuilderCreated = (builder, renderObject) => {
    previous?.(builder, renderObject);
    const context = (renderObject as { context?: unknown } | undefined)?.context;
    const b = builder as { _getBindGroup?: (...a: unknown[]) => unknown };
    const own = b._getBindGroup;
    if (!context || typeof own !== 'function') return;
    b._getBindGroup = function (this: unknown, ...args: unknown[]) {
      const outer = r._currentRenderContext;
      r._currentRenderContext = context;
      try {
        return own.apply(this, args);
      } finally {
        r._currentRenderContext = outer;
      }
    };
  };
}
