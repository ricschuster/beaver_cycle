// A little grain in the props (ADR 0012, #458): a small grey texture made in code, multiplied into the colour of the
// faces that ask for it. A geometry says where with a `grain` attribute (0 none, 1 bark, 2 rock; `paintFaces`) and how the
// texture lies with its `uv` (`barkUv`, `rockUv`), so cut wood ends and mud stay plain. Two 64 px textures are shared by
// every material, and the draw calls and triangles of a prop do not change.
import * as THREE from 'three';
import { hash, smoothstep } from './modelKit';

/** Texels per side of the bark texture. */
export const BARK_GRAIN_SIZE = 64;
/** The bark texture's mean brightness is about 0.75, so the colour is multiplied by this to keep its own brightness. */
const GAIN = 1.3;

/** The rock texture's mean brightness is about 0.81, so the colour is multiplied by this to keep its own brightness. */
const ROCK_GAIN = 1.23;

/** Soft rock speckle (a few broad lumps and fine grain, no cracks, B in the texture preview), grey texels, tiling. */
export function rockGrainData(size = BARK_GRAIN_SIZE): Uint8Array {
  const out = new Uint8Array(size * size * 4);
  const noise = (x: number, y: number, p: number): number => hash(Math.floor(x / p) % size, Math.floor(y / p) % size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = 0.62 + 0.2 * noise(x, y, 8) + 0.12 * noise(x + 5, y + 3, 4) + 0.06 * hash(x, y);
      const g = Math.round(255 * Math.min(1, Math.max(0, v)));
      out.set([g, g, g, 255], (y * size + x) * 4);
    }
  }
  return out;
}

/** Bark furrows that run along v (down the texture), broken a little across, as grey texels 0 to 255, tiling without a seam. */
export function barkGrainData(size = BARK_GRAIN_SIZE): Uint8Array {
  const out = new Uint8Array(size * size * 4);
  const cells = 10; // furrows round the texture, a whole number so the sine wraps
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const c = Math.floor((x / size) * cells);
      const furrow = smoothstep(0, 1, 0.5 + 0.5 * Math.sin((x / size) * cells * 2 * Math.PI + hash(c, 9) * 3));
      const crossBreak = hash(c, Math.floor(((y / size) * 8) % 8));
      const v = 0.58 + 0.25 * hash(c, 3) * furrow + 0.1 * crossBreak + 0.05 * furrow;
      const g = Math.round(255 * Math.min(1, Math.max(0, v)));
      out.set([g, g, g, 255], (y * size + x) * 4);
    }
  }
  return out;
}

let bark: THREE.DataTexture | null = null;
let rock: THREE.DataTexture | null = null;

function grainTexture(data: Uint8Array): THREE.DataTexture {
  const tex = new THREE.DataTexture(data, BARK_GRAIN_SIZE, BARK_GRAIN_SIZE);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** The shared bark grain texture. Read as plain numbers (no colour space), since it only scales the colour. */
export function barkGrain(): THREE.DataTexture {
  return (bark ??= grainTexture(barkGrainData()));
}

/** The shared rock grain texture. */
export function rockGrain(): THREE.DataTexture {
  return (rock ??= grainTexture(rockGrainData()));
}

/**
 * The prop material (lit, flat shaded, vertex colours) with the grain on the faces whose `grain` is above 0 (1 bark, 2 rock). Call
 * before the material's `prepare` (the shadow setup), which wraps `onBeforeCompile`.
 */
export function grainMaterial(options: THREE.MeshLambertMaterialParameters = {}): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, ...options });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uGrain = { value: barkGrain() };
    shader.uniforms.uRock = { value: rockGrain() };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float grain;\nvarying float vGrain;\nvarying vec2 vGrainUv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGrain = grain;\nvGrainUv = uv;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vGrain;\nvarying vec2 vGrainUv;\nuniform sampler2D uGrain;\nuniform sampler2D uRock;')
      .replace('#include <color_fragment>', `#include <color_fragment>\nfloat g = vGrain > 1.5 ? texture2D(uRock, vGrainUv).r * ${ROCK_GAIN.toFixed(2)} : texture2D(uGrain, vGrainUv).r * ${GAIN.toFixed(2)};\ndiffuseColor.rgb *= mix(1.0, g, min(vGrain, 1.0));`);
  };
  m.customProgramCacheKey = () => 'prop-grain-2';
  return m;
}
