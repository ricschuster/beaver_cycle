// Image textures for the look (#458): the same rock and log drawn three ways, side by side, close up and from afar.
//   A  the game today: one colour per face, no texture.
//   B  a small texture made in code (64 px), like the animals' grain in modelKit.ts.
//   C  a 256 px image texture (rock.png, bark.png from make_textures.py), the stand-in for an artist's or a CC0 image.
// B and C are laid on by position and surface direction (triplanar), so no model needs UVs. `npx vite --port 5203` and
// open /tools/texture-preview/. A tool for the decision in docs/decisions/0012, not the game.
import * as THREE from 'three';
import { BARK, lump, mergeParts, paintLump, propMaterial, seeded, stick, stickBetween } from '../../src/render/propShapes';
import { patternTexture, hash, smoothstep } from '../../src/render/modelKit';

const CELL = 400;
const canvas = document.getElementById('view') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(1);
renderer.setScissorTest(true);

const loader = new THREE.TextureLoader();
function image(url: string): THREE.Texture {
  const t = loader.load(url);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = 4;
  return t;
}
const noise = (x: number, y: number, p: number): number => hash(Math.floor(x / p) % 64, Math.floor(y / p) % 64);
// 64 px made in code: speckle over a few lumps (rock), and furrows (bark). Grey, mean about 0.75.
const codeRock = patternTexture(64, (x, y) => 0.62 + 0.2 * noise(x, y, 8) + 0.12 * noise(x + 5, y + 3, 4) + 0.06 * hash(x, y));
const codeBark = patternTexture(64, (x, y) => 0.58 + 0.25 * hash(x, 3) * smoothstep(0, 1, 0.5 + 0.5 * Math.sin(x * 1.2 + hash(x, 9) * 3)) + 0.1 * hash(x, Math.floor(y / 6)));
for (const t of [codeRock, codeBark]) t.colorSpace = THREE.NoColorSpace;
const imageRock = image('./rock.png');
const imageBark = image('./bark.png');

/** A Lambert material that multiplies a grey texture into the colour by position (triplanar), `metres` per repeat. */
function triplanar(map: THREE.Texture, metres: number, along: boolean): THREE.MeshLambertMaterial {
  const m = propMaterial();
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTex = { value: map };
    shader.uniforms.uScale = { value: 1 / metres };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTriPos;\nvarying vec3 vTriN;\nuniform float uScale;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTriPos = position * uScale;\nvTriN = normal;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTriPos;\nvarying vec3 vTriN;\nuniform sampler2D uTex;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec3 tw = pow(abs(vTriN), vec3(4.0));
        tw /= (tw.x + tw.y + tw.z);
        vec2 uvx = vTriPos.zy;
        vec2 uvy = ${along ? 'vTriPos.zx' : 'vTriPos.xz'};
        vec2 uvz = ${along ? 'vTriPos.yx' : 'vTriPos.xy'};
        float g = texture2D(uTex, uvx).r * tw.x + texture2D(uTex, uvy).r * tw.y + texture2D(uTex, uvz).r * tw.z;
        diffuseColor.rgb *= g * 1.3;`,
      );
  };
  return m;
}

/** The rock: a boulder with moss, and a smaller slab. */
function rocks(): THREE.BufferGeometry {
  const r = seeded(101);
  const stone = new THREE.Color(0x8d8f8c);
  const moss = new THREE.Color(0x6f7d4a);
  const a = paintLump(lump(r, 0.18, 0, -0.5), stone, r, { color: moss, share: 0.25 }).scale(1.1, 1.1, 1.1);
  const b = paintLump(lump(r, 0.3, 0, -0.3), stone, r, { color: moss, share: 0.25 }).scale(0.7, 0.5, 0.7).translate(1.6, 0, 0.4);
  return mergeParts([a, b]);
}
/** A log of bark with pale cut ends, and two sticks. */
function logs(): THREE.BufferGeometry {
  const r = seeded(31);
  const big = stick(3.2, 0.4, 9, BARK[0]!, r).translate(0, 0.4, 0);
  const s1 = stickBetween(new THREE.Vector3(-0.8, 0.1, 1.1), new THREE.Vector3(0.9, 0.2, 1.4), 0.07, 5, BARK[1]!, r);
  const s2 = stickBetween(new THREE.Vector3(-0.6, 0.1, 1.5), new THREE.Vector3(0.5, 0.15, 1.9), 0.06, 5, BARK[3]!, r);
  return mergeParts([big, s1, s2]);
}

interface Cell {
  name: string;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
}
function cell(name: string, geometry: THREE.BufferGeometry, material: THREE.Material, eye: [number, number, number], at: [number, number, number], ground: number): Cell {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xcfe3d4);
  scene.fog = new THREE.Fog(0xcfe3d4, 40, 400);
  scene.add(new THREE.HemisphereLight(0xdfefff, 0x5a4a30, 1.4));
  const sun = new THREE.DirectionalLight(0xfff2dd, 2.2);
  sun.position.set(30, 50, 20);
  scene.add(sun);
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: ground })));
  scene.add(new THREE.Mesh(geometry, material));
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 500);
  camera.position.set(...eye);
  camera.lookAt(...at);
  return { name, scene, camera };
}

const rockGeo = rocks();
const logGeo = logs();
const cells: Cell[] = [];
const variants: { name: string; rock: () => THREE.Material; bark: () => THREE.Material }[] = [
  { name: 'A per face colour (today)', rock: () => propMaterial(), bark: () => propMaterial() },
  { name: 'B 64 px made in code', rock: () => triplanar(codeRock, 1.2, false), bark: () => triplanar(codeBark, 0.8, true) },
  { name: 'C 256 px image', rock: () => triplanar(imageRock, 1.2, false), bark: () => triplanar(imageBark, 0.8, true) },
];
const rows: { what: string; geo: THREE.BufferGeometry; pick: (v: (typeof variants)[number]) => THREE.Material; eye: [number, number, number]; at: [number, number, number]; ground: number }[] = [
  { what: 'rock close', geo: rockGeo, pick: (v) => v.rock(), eye: [1.8, 1.4, 3.0], at: [0.6, 0.5, 0], ground: 0x8a8a6a },
  { what: 'rock far', geo: rockGeo, pick: (v) => v.rock(), eye: [9, 5, 14], at: [0.6, 0.3, 0], ground: 0x8a8a6a },
  { what: 'log close', geo: logGeo, pick: (v) => v.bark(), eye: [1.5, 1.4, 3.4], at: [0, 0.4, 0.4], ground: 0x7fa36b },
  { what: 'log far', geo: logGeo, pick: (v) => v.bark(), eye: [8, 5, 13], at: [0, 0.3, 0.4], ground: 0x7fa36b },
];
for (const row of rows) for (const v of variants) cells.push(cell(`${v.name}, ${row.what}`, row.geo, row.pick(v), row.eye, row.at, row.ground));

const labels = document.getElementById('labels')!;
function draw(): void {
  cells.forEach((c, i) => {
    const x = (i % 3) * CELL;
    const y = Math.floor(i / 3) * CELL;
    const top = canvas.height - y - CELL;
    renderer.setViewport(x, top, CELL, CELL);
    renderer.setScissor(x, top, CELL, CELL);
    renderer.render(c.scene, c.camera);
  });
}
cells.forEach((c) => {
  const label = document.createElement('div');
  label.textContent = c.name;
  labels.appendChild(label);
});
// The images load a moment after the page, so draw again until they are in.
let frames = 0;
const loop = (): void => {
  draw();
  if (frames++ < 30) requestAnimationFrame(loop);
  else (window as unknown as { ready: boolean }).ready = true;
};
loop();

// What a texture costs on the GPU: width x height x 4 bytes, a third more with mipmaps.
const mb = (n: number): string => ((n * n * 4 * (4 / 3)) / 1048576).toFixed(2);
document.getElementById('notes')!.textContent = [
  'GPU memory per texture, RGBA with mipmaps:',
  `  64 px:   ${mb(64)} MB`,
  `  256 px:  ${mb(256)} MB`,
  `  512 px:  ${mb(512)} MB`,
  `  1024 px: ${mb(1024)} MB`,
  '',
  'Today the game holds 65 MB of graphics.',
  'Triplanar reads 3 texels per pixel;',
  'the ground already reads 2 (groundDetail.ts).',
].join('\n');
