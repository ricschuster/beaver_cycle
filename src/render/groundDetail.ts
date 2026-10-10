// A little texture in the ground, so it is not one flat colour per land cover class. A small tiling noise texture is
// laid on the ground by world position, twice: once large, for lighter and darker, warmer and cooler patches tens of
// metres across, and once small, for grain underfoot. How much it shows comes from the land cover (more on rock and
// bare ground, less on meadow, little on snow) and the slope; steep faces also turn to rock (terrainView). Two
// texture reads and no loops, so it stays cheap on a tablet. The grain fades out with distance and the mipmaps smooth
// the rest, so it does not shimmer or show as a pattern far away.
import * as THREE from 'three';

/** Texels per side of the noise texture. */
export const NOISE_SIZE = 64;
/** Metres the noise texture covers when laid large and when laid small. */
export const NOISE_LARGE_M = 53;
export const NOISE_SMALL_M = 5.3;

/** A stable number in [0, 1) for a lattice point and a seed. */
function hash(i: number, j: number, seed: number): number {
  let h = (Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(seed, 2246822519)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise at a texel, with `period` lattice cells across the texture, so it wraps without a seam. */
function valueNoise(x: number, y: number, size: number, period: number, seed: number): number {
  const cell = size / period;
  const u = x / cell;
  const v = y / cell;
  const i = Math.floor(u);
  const j = Math.floor(v);
  const fu = u - i;
  const fv = v - j;
  const su = fu * fu * (3 - 2 * fu);
  const sv = fv * fv * (3 - 2 * fv);
  const at = (a: number, b: number): number => hash(((a % period) + period) % period, ((b % period) + period) % period, seed);
  const top = at(i, j) + (at(i + 1, j) - at(i, j)) * su;
  const bottom = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * su;
  return top + (bottom - top) * sv;
}

/**
 * The noise texture's texels, RGBA, `size` by `size`, tiling without a seam. Each of r, g, and b is its own noise of
 * a few octaves, stretched to the full 0 to 255; a is 255.
 */
export function groundNoiseData(size = NOISE_SIZE): Uint8Array {
  const out = new Uint8Array(size * size * 4);
  for (let c = 0; c < 3; c++) {
    const raw = new Float32Array(size * size);
    let lo = Infinity;
    let hi = -Infinity;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const n = 0.5 * valueNoise(x, y, size, 4, 10 + c) + 0.3 * valueNoise(x, y, size, 8, 20 + c) + 0.2 * valueNoise(x, y, size, 16, 30 + c);
        raw[y * size + x] = n;
        lo = Math.min(lo, n);
        hi = Math.max(hi, n);
      }
    }
    for (let k = 0; k < size * size; k++) out[k * 4 + c] = Math.round((255 * (raw[k]! - lo)) / (hi - lo));
  }
  for (let k = 0; k < size * size; k++) out[k * 4 + 3] = 255;
  return out;
}

/** The noise as a repeating, mipmapped texture. */
export function groundNoiseTexture(): THREE.DataTexture {
  const tex = new THREE.DataTexture(groundNoiseData(), NOISE_SIZE, NOISE_SIZE, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

/**
 * How strongly the ground of each land cover class shows the noise, as a share of its brightness either way:
 * little on meadow, more on bare ground and the forest floor, most on rock and scree.
 */
export const DETAIL: Record<number, number> = {
  0: 0.16, // ground
  1: 0.09, // meadow
  2: 0.14, // forest
  3: 0.13, // scrub
  4: 0.26, // rock
  5: 0.12, // wetland
  9: 0.08, // lake bed
};
