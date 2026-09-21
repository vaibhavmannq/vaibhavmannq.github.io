import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { pass } from 'three/tsl';
import type { Camera, Node, Scene } from 'three/webgpu';
import { NoToneMapping, RenderPipeline, WebGPURenderer } from 'three/webgpu';
import type { TierSettings } from '../quality/tiers';

export interface MoonlitRenderer {
  readonly renderer: WebGPURenderer;
  readonly backend: 'webgpu' | 'webgl2';
  /** Build the output graph for this scene (call once per scene/camera). */
  setView(scene: Scene, camera: Camera): void;
  applyTier(settings: TierSettings, devicePixelRatio: number): void;
  resize(width: number, height: number): void;
  render(): void;
  /**
   * Renders one hidden frame through each output, plain and with bloom, so their shaders compile now
   * rather than on the first visible frame (or the first tier change). Call while the opening covers
   * the canvas: the first bloom frame blocked the page for ~385 ms in a local measurement, freezing the
   * opening's fade on desktop (owner, 2026-09-22).
   */
  warmUp(): void;
}

/** Throws if neither WebGPU nor WebGL2 is available; boot.ts catches that and shows stills. */
export async function createRenderer(container: HTMLElement, forceWebGL: boolean): Promise<MoonlitRenderer> {
  const renderer = new WebGPURenderer({ antialias: false, forceWebGL });
  await renderer.init();
  // The sea shader applies the prototype's own tone curve; the pipeline only converts to sRGB.
  renderer.toneMapping = NoToneMapping;
  // The container is sized to the large viewport (overlay.css), which a phone's toolbar never changes.
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.append(renderer.domElement);

  const backend = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend === true ? 'webgpu' : 'webgl2';
  const pipeline = new RenderPipeline(renderer);

  let plainOutput: Node | null = null;
  let bloomOutput: Node | null = null;
  let bloomEnabled = false;

  const selectOutput = () => {
    const next = bloomEnabled ? bloomOutput : plainOutput;
    if (next === null) return;
    pipeline.outputNode = next;
    pipeline.needsUpdate = true;
  };

  return {
    renderer,
    backend,
    setView(scene, camera) {
      const scenePass = pass(scene, camera);
      const color = scenePass.getTextureNode('output');
      plainOutput = color;
      // Both graphs are built once; switching tiers just picks one (no rebuild, no leaks)
      bloomOutput = color.add(bloom(color, 0.45, 0.4, 0.6));
      selectOutput();
    },
    applyTier(settings, devicePixelRatio) {
      renderer.setPixelRatio(devicePixelRatio * settings.renderScale);
      if (settings.bloom !== bloomEnabled) {
        bloomEnabled = settings.bloom;
        selectOutput();
      }
    },
    resize(width, height) {
      renderer.setSize(width, height);
    },
    warmUp() {
      const wanted = bloomEnabled;
      for (const bloom of [false, true]) {
        bloomEnabled = bloom;
        selectOutput();
        pipeline.render();
      }
      bloomEnabled = wanted;
      selectOutput();
    },
    render() {
      pipeline.render();
    },
  };
}
