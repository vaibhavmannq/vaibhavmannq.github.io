# three.js notes for this project (we are on 0.186)

Marks: **[read]** opened the source, **[search]** search summary, **[mine]** my reasoning. See `README.md`.
The example code below is from the three.js repository at tag `r186` (MIT licence).
Base URL for any example: `https://raw.githubusercontent.com/mrdoob/three.js/r186/examples/<name>.html`

## 1. Releases after ours

Newest release: **r188** [read, the Migration Guide wiki].

**r186 → r187** [read]
- TSL math functions now coerce operands to the broader common type (#33695). A `float` mixed with a `vec3`
  may change meaning silently: re-run the look checks.
- PMREMs are built on cube render targets (#34585); `CubeUVReflectionMapping` is gone; "materials may look
  slightly different".
- Both renderers use `WeakRef` and `FinalizationRegistry` inside (#34368).
- `setViewport()` and `setScissor()` no longer scale by pixel ratio when a render target is bound (#34460).
  **Touches our reflection pass and any half-size target.**
- Custom lights register with `CustomLight.registerNode( CustomLightNode )` (#34622).
- TSL treats struct storage buffers as arrays (#34807). `pixelationPass()` takes a plain number (#34543).

**r187 → r188** [read]
- `TemporalReprojectNode` and `RecurrentDenoiseNode` removed (#35318). We use neither.

**r185 → r186 (already ours, worth knowing)** [read]
- `Object3D.dispose()` exists; subclasses call `super.dispose()`.
- `PCFSoftShadowMap` is removed for WebGPURenderer; `PCFShadowMap` is soft now.
- `SimplifyModifier` is meshoptimizer-based and `modify()` is async.
- `Source` is renamed `TextureSource`. `Sky`/`SkyMesh` always assume +Y up.

**Earlier, still relevant:** `PostProcessing` was renamed `RenderPipeline` in r183 [read]. r183 also added a
written TSL specification (`TSL.md` in the repo) [search].

**Verdict [mine]:** stay on 0.186 through M7; decide at M8 with the compare tool.

## 2. Patterns, exact, from the r186 examples

### 2.1 Compile before showing (plan Review Focus 2) [read, `webgpu_compile_async`]

```js
// the group is NOT in the scene yet
await renderer.compileAsync( meshGroup, camera, scene );
scene.add( meshGroup ); // already compiled: renders with no hitch
```

The third argument is the scene the object will join (its lights and fog decide the shader). The example measures
the longest frame during the compile, which is our "no frame over 50 ms" test in small.

### 2.2 Many small sprites in one draw (fireflies, spray, mist, plankton) [read, `webgpu_particles`]

```js
import * as THREE from 'three/webgpu';
import { range, texture, mix, uv, color, rotateUV, positionLocal, time, uniform } from 'three/tsl';

const lifeRange = range( .1, 1 );                    // a different value per instance
const offsetRange = range( new THREE.Vector3( - 2, 3, - 2 ), new THREE.Vector3( 2, 5, 2 ) );
const scaledTime = time.add( 5 ).mul( uniform( .2 ) );
const lifeTime = scaledTime.mul( lifeRange ).mod( 1 ); // each sprite loops on its own period
const life = lifeTime.div( lifeRange );

const m = new THREE.SpriteNodeMaterial();
m.positionNode = offsetRange.mul( lifeTime );
m.scaleNode = range( .3, 2 ).mul( lifeTime.max( 0.3 ) );
m.opacityNode = texture( map, rotateUV( uv(), scaledTime ) ).a.mul( life.oneMinus() );
m.blending = THREE.AdditiveBlending; m.transparent = true; m.depthWrite = false;

const sprites = new THREE.Mesh( new THREE.PlaneGeometry( 1, 1 ), m );
sprites.count = 2000;                                 // instancing: just set count
```

- `range( a, b )` gives a per-instance random value with no attribute of our own.
- `SpriteNodeMaterial` faces the camera for us; a plain `Mesh` with `.count` is the instanced draw.
- This example has **no** depth fade. For soft edges where a sprite meets the ground or water, look at
  `webgpu_particles_soft` (not read) and `webgpu_backdrop_water` (not read; I expect `viewportDepthTexture`,
  `viewportLinearDepth` and `linearDepth` from `three/tsl` [mine], confirm in the file). A depth read costs a
  copy of the depth buffer: measure on the phone.
- Our plan keeps spray inside the waterfall's one mesh with its own `corner` attribute. That is still fewer
  materials (D13). Use the pattern above only where a part needs its own draw anyway.

### 2.3 Bloom only what glows [read, `webgpu_postprocessing_bloom_emissive`]

```js
import { pass, mrt, output, emissive, vec4 } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';

const scenePass = pass( scene, camera );
const mrtNode = mrt( { output: output, emissive: vec4( emissive, output.a ) } );
mrtNode.setBlendMode( 'emissive', new THREE.BlendMode( THREE.NormalBlending ) );
scenePass.setMRT( mrtNode );

const emissiveTexture = scenePass.getTexture( 'emissive' );
emissiveTexture.type = THREE.UnsignedByteType;        // "optimize the bandwidth"

const bloomPass = bloom( scenePass.getTextureNode( 'emissive' ), 2.5, .5 );
renderPipeline = new THREE.RenderPipeline( renderer );
renderPipeline.outputNode = scenePass.getTextureNode().add( bloomPass );
// each frame: renderPipeline.render();
```

A material joins the glow by setting its `emissiveNode`. Named targets other than `output` and `depth` do not
exist until `setMRT` is called [read, Maxime Heckel's field guide].

### 2.4 Mirror [read, `webgpu_mirror`]

```js
import { reflector, uv, texture, color } from 'three/tsl';
const groundReflector = reflector();
groundReflector.uvNode = groundReflector.uvNode.add( normalTexXY.mul( 2 ).sub( 1 ).mul( - 0.08 ) ); // ripple
plane.add( groundReflector.target );                 // the mirror plane is the target's parent transform
```

The mirror plane follows `reflector.target`'s parent. So M2 Task 6's "the one mirror moves to the cave floor" is
a move of that target [mine, from the code above]. The example sets no resolution option; ours already does.

### 2.5 Height fog (First light's mist, the lagoon floor) [read, `webgpu_fog_height`]

```js
import { exponentialHeightFogFactor, uniform, fog, color } from 'three/tsl';
const fogFactor = exponentialHeightFogFactor( uniform( 0.04 ), uniform( 2 ) ); // density, height
scene.fogNode = fog( color( 0xffdfc1 ), fogFactor );
```

A built-in: fog that thickens below a height. D17 colours our fog from the sky's horizon; the factor can be
combined with it. Related, not read: `webgpu_custom_fog`, `webgpu_custom_fog_scattering`, `webgpu_postprocessing_fog`.

### 2.6 What a real volume costs [read, `webgpu_volume_cloud`]

`RaymarchingBox( steps, ... )` from `three/addons/tsl/utils/Raymarching.js`, 128³ single-channel 3D texture,
100 steps by default, 3 texture reads a step, early exit at alpha 0.95, no real lighting. Fine for a small puff
(a mist bank seen from afar at low resolution), not for a screen-filling deck on a phone.

## 3. TSL habits worth keeping [read, Maxime Heckel, "Field Guide to TSL and WebGPU"]

- `uniform()` takes boolean, number, Color, Vector2/3/4, Matrix3/4 only. Textures go through `texture()`.
- Displaced surfaces: displace two neighbours on the tangent plane, cross the two edges, pass the normal through
  `varying()`, return `transformNormalToView( vNormal )` from `normalNode`. (Our cloud deck and sea already do
  a version of this.)
- Mutable values need `.toVar()`; write with `.assign()`. Loops and `If` are TSL constructs, not JS ones.
- `instanceIndex` means different things in compute and in the vertex stage.
- Compute (`instancedArray`, `.compute( count )`, `renderer.compute( node )`) is WebGPU only in practice. Our
  phone path must also run on WebGL2 (D18), so **nothing essential may depend on compute** [mine].
- A port from another shader language can drift: constants differed between the author's own two ports. Our
  ledger already found the same thing (noise 1.6× coarser than Blender's).

## 4. General tips that apply to us [read, Utsubo, "100 Three.js Tips" (2026)]

Already ours: instancing, shared materials, merged static geometry, meshopt, DPR cap 2, frozen shadow map at
stops, tone mapping last. Worth a look:

| Tip | Why it matters here |
|---|---|
| `renderer.compileAsync` in loading; "since r184 it doesn't block rendering" | Review Focus 2 |
| `THREE.Timer` for frame deltas (pauses on hidden tabs) | no jump in drift or flight after a tab switch |
| `renderer.onDeviceLost` | phones lose the GPU when the browser is backgrounded: show the still, rebuild |
| `reversedDepthBuffer` (WebGPU, r183+), far `camera.near` | a 0.55 m eye height and a 7 km horizon in one frame; candidate fix if far water or the horizon ring flickers |
| `alphaTest` or `alphaToCoverage` for foliage, not blending | leaf cards, vines, heather: no sorting, depth stays correct |
| `light.shadow.autoUpdate = false`, tight shadow frustum, 512–1024 maps on phones | spec §9.12 freezes the map at stops; our low tier uses 1024 |
| Bloom at lower resolution, threshold 0.8–1.0 | bloom is off on low today; a half-size bloom may be affordable there |
| `<link rel="preload" as="fetch" crossorigin>` for first-view assets | D9's 3 s first view; keep `crossorigin` or the file downloads twice |
| KTX2: 4–8× less GPU memory than a decoded PNG/JPEG/WebP; call `detectSupport( renderer )` after `init()` | D14's trigger is phone GPU memory; this is the size of the win if it trips |
| stats-gl with `trackGPU`, renderer `trackTimestamp` (experimental) | plan Task 7's cost per part |
| About 100 draws a frame is the usual phone target | our 60 is already stricter |

## 5. Which official example shows what [read, `threejs.org/examples/files.json`]

| Need | Examples to open |
|---|---|
| Water, mirror | `webgpu_backdrop_water`, `webgpu_water`, `webgpu_ocean`, `webgpu_mirror`, `webgpu_reflection`, `webgpu_reflection_blurred`, `webgpu_caustics` |
| Sea motion in TSL | `webgpu_tsl_raging_sea` |
| Fog, mist | `webgpu_fog_height`, `webgpu_custom_fog`, `webgpu_custom_fog_scattering`, `webgpu_postprocessing_fog` |
| Volumes | `webgpu_volume_cloud`, `webgpu_volume_perlin`, `webgpu_volume_lighting` |
| Sprites, particles | `webgpu_particles`, `webgpu_particles_soft`, `webgpu_instance_sprites`, `webgpu_sprites`, `webgpu_tsl_vfx_linkedparticles` |
| Instancing | `webgpu_instance_mesh`, `webgpu_instance_uniform`, `webgpu_mesh_batch` |
| Bloom | `webgpu_postprocessing_bloom`, `_bloom_emissive`, `_bloom_selective` |
| Fades between scenes | `webgpu_postprocessing_transition`, `webgpu_tsl_occlusion_dither` (dithered dissolve, spec §12 stage B) |
| Stars as shader | `webgpu_tsl_galaxy` |
| Terrain in TSL | `webgpu_tsl_procedural_terrain` |
| Shadows | `webgpu_shadowmap_csm`, `webgpu_shadow_contact`, `webgpu_lights_sunlight` (r186's two-cascade `SunLight`) |
| Compile, speed | `webgpu_compile_async`, `webgpu_performance`, `webgpu_performance_renderbundle` |
| Sky | `webgpu_sky` |
| Lens effects | `webgpu_postprocessing_lensflare`, `webgpu_postprocessing_godrays`, `webgpu_postprocessing_anamorphic` |
| God rays from the cave mouth | `webgpu_postprocessing_godrays`, `webgpu_volume_lighting` (costly; judge as an option only) |

No official example exists for stars as points, fireflies, grass, trees or level of detail.

## Sources

- Migration Guide: https://github.com/mrdoob/three.js/wiki/Migration-Guide
- Example list: https://threejs.org/examples/files.json
- Maxime Heckel, Field Guide to TSL and WebGPU: https://blog.maximeheckel.com/posts/field-guide-to-tsl-and-webgpu/
- Utsubo, 100 Three.js Tips (2026): https://www.utsubo.com/blog/threejs-best-practices-100-tips
- three.js manual, WebGPURenderer: https://threejs.org/manual/en/webgpurenderer.html
