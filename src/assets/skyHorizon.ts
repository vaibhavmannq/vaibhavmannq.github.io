/**
 * The soft colour of a sky photo's horizon, by compass direction: what distant sea and land fade into, and what the sky
 * shows below the horizon. The photo's own horizon row has clouds and the sun in it (used directly it drew vertical
 * streaks), so the decode worker paints a blurred version into the photo's bottom rows: straight down, never on screen.
 * The sky shader then reads it like any other sky pixel (world/sky.ts horizonAt), blended like the two skies.
 */
export const HORIZON_BINS = 16;
/** Rows painted, from the bottom (the shader samples inside them, clear of the photo above). */
export const HORIZON_ROWS = 6;
/** The band averaged, in degrees above the horizon. */
const BAND = [0.5, 5] as const;

/**
 * `data` is RGBA, rows bottom-first (as the decode worker delivers them), an equirectangular photo. The mean is taken
 * over the stored values, which are display-like, so it is the typical colour: a mean of raw light is ruled by glare.
 */
export function paintHorizon(pixels: { width: number; height: number; data: Uint8Array }): void {
  const { width, height, data } = pixels;
  const y0 = Math.floor(((BAND[0] + 90) / 180) * height);
  const y1 = Math.max(y0 + 1, Math.ceil(((BAND[1] + 90) / 180) * height));
  const sum = new Float64Array(HORIZON_BINS * 3);
  const count = new Float64Array(HORIZON_BINS);
  const stride = Math.max(1, Math.floor(width / 512));
  for (let y = y0; y < y1 && y < height; y++)
    for (let x = 0; x < width; x += stride) {
      const bin = Math.min(HORIZON_BINS - 1, Math.floor((x / width) * HORIZON_BINS));
      const i = (y * width + x) * 4;
      sum[bin * 3] += data[i] as number;
      sum[bin * 3 + 1] += data[i + 1] as number;
      sum[bin * 3 + 2] += data[i + 2] as number;
      count[bin] += 1;
    }
  const mean = (bin: number, c: number) => (sum[bin * 3 + c] as number) / Math.max(1, count[bin] as number);
  for (let x = 0; x < width; x++) {
    // Blend between the two nearest directions' centres, around the compass.
    const f = (x / width) * HORIZON_BINS - 0.5;
    const b0 = ((Math.floor(f) % HORIZON_BINS) + HORIZON_BINS) % HORIZON_BINS;
    const b1 = (b0 + 1) % HORIZON_BINS;
    const w = f - Math.floor(f);
    for (let c = 0; c < 3; c++) {
      const v = Math.round(mean(b0, c) * (1 - w) + mean(b1, c) * w);
      for (let row = 0; row < HORIZON_ROWS && row < height; row++) data[(row * width + x) * 4 + c] = v;
    }
  }
}
