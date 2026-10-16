// A little grain in the props (ADR 0012, #458): a small grey texture made in code, multiplied into the colour of the
// faces that ask for it. A geometry says where with a `grain` attribute (0 none, 1 bark; `paintFaces`) and how the
// texture lies with its `uv` (`barkUv`), so cut wood ends and mud stay plain. One 64 px texture is shared by every
// material, and the draw calls and triangles of a prop do not change.
import * as THREE from 'three';
import { hash, smoothstep } from './modelKit';

/** Texels per side of the bark texture. */
export const BARK_GRAIN_SIZE = 64;
/** The bark texture's mean brightness is about 0.75, so the colour is multiplied by this to keep its own brightness. */
const GAIN = 1.3;

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

/** The shared bark grain texture. Read as plain numbers (no colour space), since it only scales the colour. */
export function barkGrain(): THREE.DataTexture {
  if (bark) return bark;
  const tex = new THREE.DataTexture(barkGrainData(), BARK_GRAIN_SIZE, BARK_GRAIN_SIZE);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  bark = tex;
  return tex;
}

/**
 * The prop material (lit, flat shaded, vertex colours) with the bark grain on the faces whose `grain` is above 0. Call
 * before the material's `prepare` (the shadow setup), which wraps `onBeforeCompile`.
 */
export function grainMaterial(options: THREE.MeshLambertMaterialParameters = {}): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, ...options });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uGrain = { value: barkGrain() };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float grain;\nvarying float vGrain;\nvarying vec2 vGrainUv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGrain = grain;\nvGrainUv = uv;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vGrain;\nvarying vec2 vGrainUv;\nuniform sampler2D uGrain;')
      .replace('#include <color_fragment>', `#include <color_fragment>\ndiffuseColor.rgb *= mix(1.0, texture2D(uGrain, vGrainUv).r * ${GAIN.toFixed(2)}, vGrain);`);
  };
  m.customProgramCacheKey = () => 'prop-grain';
  return m;
}
