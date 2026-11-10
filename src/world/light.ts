import { densityFogFactor, fog, uniform } from 'three/tsl';
import { Color, DirectionalLight, HemisphereLight, type Scene, Vector3 } from 'three/webgpu';
import type { SkyAmbient } from '../assets/manifest';
import { sunDir } from '../journey/hours';
import { type HourPreset, type RGB, toThree, type Vec3 } from '../journey/types';
import { lerp } from '../shared/math';

/**
 * Factors from Blender's units to this renderer's, taken from the slice's hand-tuned Golden and Sunset numbers
 * (s02: sun intensity 2.2 for sun_str 3.5, exposure 0.42 for expo 0.5, fog 0.00032 for fog_amt 0.12). Tune by eye.
 */
export const KEY_SCALE = 0.6;
export const EXPOSURE_SCALE = 0.84;
export const FOG_SCALE = 0.0027;
export const FOG_COLOUR_SCALE = 0.65;
export const HEMI_INTENSITY = 2.0;
export const FILL_SHARE = 0.25;

/** Everything the materials read about the light this frame; three.js axes. */
export interface LightValues {
  keyDir: Vec3;
  keyColor: RGB;
  keyStrength: number;
  ambSky: RGB;
  ambGround: RGB;
  fogColor: RGB;
  fogDensity: number;
  exposure: number;
  skyGain: number;
  skyTint: RGB;
  skyWeight: number;
  stars: number;
  moonDir: Vec3;
  moonSize: number;
  moonStrength: number;
}

const mix3 = (a: RGB, b: RGB, w: number): RGB =>
  w <= 0 ? a : w >= 1 ? b : [lerp(a[0], b[0], w), lerp(a[1], b[1], w), lerp(a[2], b[2], w)];
const scale3 = (a: RGB, k: number): RGB => [a[0] * k, a[1] * k, a[2] * k];

/** Pure: an hour (already blended) and the two skies' ambient light, mixed by how far b's sky has faded in. */
export function lightValues(hour: HourPreset, ambA: SkyAmbient, ambB: SkyAmbient, skyWeight: number): LightValues {
  const moon = hour.moon;
  return {
    keyDir: toThree(hour.key.dir),
    keyColor: hour.key.color,
    keyStrength: hour.key.strength * KEY_SCALE,
    ambSky: mix3(ambA.ambientSky, ambB.ambientSky, skyWeight),
    ambGround: mix3(ambA.ambientGround, ambB.ambientGround, skyWeight),
    fogColor: scale3(hour.fogColor, FOG_COLOUR_SCALE),
    fogDensity: hour.fogAmount * FOG_SCALE,
    exposure: hour.exposure * EXPOSURE_SCALE,
    skyGain: hour.skyGain,
    // coast.py's hybrid style multiplies the sky by (1, 1, 1), whatever sky_tint says
    skyTint: [1, 1, 1],
    skyWeight,
    stars: hour.stars,
    moonDir: moon ? toThree(sunDir(moon.el, moon.az)) : [0, 1, 0],
    moonSize: moon ? moon.sizeDeg : 0,
    moonStrength: moon ? moon.strength : 0,
  };
}

/** The shared TSL uniforms every material reads, and the scene's three lights. */
export function createLightUniforms() {
  const u = {
    keyDir: uniform(new Vector3(0, 0.1, -1)),
    keyColor: uniform(new Color(1, 0.62, 0.36)),
    keyStrength: uniform(1),
    ambSky: uniform(new Color(0.3, 0.25, 0.3)),
    ambGround: uniform(new Color(0.1, 0.08, 0.08)),
    fogColor: uniform(new Color(0.5, 0.35, 0.35)),
    fogDensity: uniform(0.00035),
    exposure: uniform(0.42),
    skyGain: uniform(1),
    skyTint: uniform(new Color(1, 1, 1)),
    skyWeight: uniform(0),
    stars: uniform(0),
    moonDir: uniform(new Vector3(0, 1, 0)),
    moonSize: uniform(0),
    moonStrength: uniform(0),
  };
  const key = new DirectionalLight(0xffffff, 2);
  /** Bounce light from the lit sea and sky opposite the key, so shadowed faces keep their shape (slice). */
  const fill = new DirectionalLight(0xffffff, 0.5);
  const hemi = new HemisphereLight(0x8070a0, 0x201810, HEMI_INTENSITY);
  const lights = [key, key.target, fill, fill.target, hemi];

  return {
    ...u,
    lights,
    /** Adds the lights and the fog to the scene. */
    install(scene: Scene) {
      scene.add(...lights);
      scene.fogNode = fog(u.fogColor, densityFogFactor(u.fogDensity));
    },
    apply(v: LightValues, cameraPosition: Vector3) {
      u.keyDir.value.set(...v.keyDir).normalize();
      u.keyColor.value.setRGB(...v.keyColor);
      u.keyStrength.value = v.keyStrength;
      u.ambSky.value.setRGB(...v.ambSky);
      u.ambGround.value.setRGB(...v.ambGround);
      u.fogColor.value.setRGB(...v.fogColor);
      u.fogDensity.value = v.fogDensity;
      u.exposure.value = v.exposure;
      u.skyGain.value = v.skyGain;
      u.skyTint.value.setRGB(...v.skyTint);
      u.skyWeight.value = v.skyWeight;
      u.stars.value = v.stars;
      u.moonDir.value.set(...v.moonDir).normalize();
      u.moonSize.value = v.moonSize;
      u.moonStrength.value = v.moonStrength;

      key.color.setRGB(...v.keyColor);
      key.intensity = v.keyStrength;
      key.position.copy(cameraPosition).addScaledVector(u.keyDir.value, 500);
      key.target.position.copy(cameraPosition);
      fill.color.setRGB(...v.ambSky);
      fill.intensity = v.keyStrength * FILL_SHARE + 0.3;
      fill.position.set(-u.keyDir.value.x, 0.6, -u.keyDir.value.z).multiplyScalar(500).add(cameraPosition);
      fill.target.position.copy(cameraPosition);
      hemi.color.setRGB(...v.ambSky);
      hemi.groundColor.setRGB(...v.ambGround);
    },
  };
}

export type LightUniforms = ReturnType<typeof createLightUniforms>;
