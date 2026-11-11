import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import {
  acesFilmicToneMapping,
  float,
  pass,
  saturation,
  screenSize,
  screenUV,
  smoothstep,
  sRGBTransferOETF,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { type Camera, type Node, NoToneMapping, RenderPipeline, type Scene, WebGPURenderer } from 'three/webgpu';
import type { LightUniforms } from '../world/light';

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
}

/** Throws if neither WebGPU nor WebGL2 is available; boot shows the stills instead. */
export async function createPipeline(host: HTMLElement, forceWebGL: boolean): Promise<Pipeline> {
  const renderer = new WebGPURenderer({
    antialias: false,
    forceWebGL,
    // Opaque: every pixel is drawn, and the compositor need not blend the page under it.
    alpha: false,
  });
  await renderer.init();
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
      const color = pass(scene, camera).getTextureNode('output');
      // The renders' vivid grade (grade.py, as in the slice): ACES, saturation 1.32, a warm tint, a soft vignette.
      const grade = (c: Node<'vec4'>): Node<'vec4'> => {
        let g = acesFilmicToneMapping(c.rgb, light.exposure) as Node<'vec3'>;
        g = (saturation(g, 1.32) as Node<'vec3'>).mul(vec3(1.03, 1.0, 0.98)).clamp(0, 1);
        const q = screenUV
          .sub(0.5)
          .mul(vec2(screenSize.x.div(screenSize.y), 1))
          .length();
        g = g.mul(float(1).sub(smoothstep(0.45, 1.15, q).pow(1.6).mul(0.24)));
        return vec4(sRGBTransferOETF(g) as Node<'vec3'>, 1);
      };
      plain = grade(color as unknown as Node<'vec4'>);
      glow = grade(color.add(bloom(color, 0.22, 0.45, 1.6)) as Node<'vec4'>);
      select();
    },
    setTier(t, devicePixelRatio) {
      renderer.setPixelRatio(devicePixelRatio * t.scale);
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
