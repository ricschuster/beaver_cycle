// The still parts of candy land (docs/design/29_dream_candy_land.md): the pastel meadow with its caramel banks and ice
// cream hills, the chocolate river with its slow swirl, the pastel sky with cotton candy clouds and a soft sun, and a
// ring of far ice cream mountains past the edge. Each is one mesh, made once per dream from the land.
import * as THREE from 'three';
import { CHOCOLATE, CHOCOLATE_LEVEL, dreamHeight, type DreamLand, type DreamProp } from '../sim/dream';
import { hash, smoothstep } from './modelKit';
import { merge, paint, scoop } from './dreamProps';
import { seeded } from './propShapes';

/** The haze and the bottom of the sky: a soft pink, so far hills melt into the sky. */
export const DREAM_FOG = 0xfbd9e8;
const SKY_TOP = 0x9fd0f6;
const SKY_MID = 0xd8c8f4;

const MINT = new THREE.Color(0xc4efd2);
const PINK = new THREE.Color(0xfcd9e6);
const LEMON = new THREE.Color(0xfcefc0);
const CARAMEL = new THREE.Color(0xe3a75c);
const BED = new THREE.Color(0x7a4426);
const CREAM = new THREE.Color(0xfff6e6);
/** Ice cream flavours for the hills: strawberry, vanilla, mint, blueberry, and lavender. */
const FLAVOURS = [0xf9bcd0, 0xfff0cf, 0xc7f1de, 0xc9ddf8, 0xe0d0f6].map((c) => new THREE.Color(c));

/** How far a prop darkens the ground around it, by kind at size 1 (a soft round shadow baked in the colours). */
const SHADE_RADIUS: Record<DreamProp['kind'], number> = { lollipop: 1.1, gumdrop: 1.4, candyCane: 0.5, cupcake: 1.9, iceCream: 0.8, marshmallowRock: 1.3 };

/**
 * The colour of the ground at a point: a meadow of soft mint, pink and lemon patches, caramel where it dips to the
 * chocolate, and the edge hills in bands of ice cream flavours with a frosting lip at their foot. Pure, for tests.
 */
export function groundColour(land: DreamLand, x: number, z: number, h: number, out = new THREE.Color()): THREE.Color {
  const rise = h - CHOCOLATE_LEVEL;
  const n = Math.sin(x * 0.085 + Math.sin(z * 0.06) * 1.8) * Math.cos(z * 0.075 - x * 0.03) + 0.35 * Math.sin((x + z) * 0.19);
  out.copy(MINT).lerp(PINK, smoothstep(0.4, 0.8, n)).lerp(LEMON, smoothstep(-0.35, -0.75, n));
  // The edge hills: how far up the hill zone the point is, from the edge distance and the height.
  const edge = land.half - Math.max(Math.abs(x), Math.abs(z));
  const angle = Math.atan2(z, x);
  const wave = 1.2 * Math.sin(angle * 23) + 0.6 * Math.sin(angle * 57 + 1);
  const hill = smoothstep(16 + wave, 12 + wave, edge) * smoothstep(2.6, 4.5, rise);
  if (hill > 0) {
    const band = ((angle / (Math.PI * 2)) * 7 + 7) % FLAVOURS.length;
    const flavour = FLAVOURS[Math.floor(band)]!.clone().lerp(FLAVOURS[Math.ceil(band) % FLAVOURS.length]!, smoothstep(0.75, 1, band % 1));
    // A cream lip where the scoop meets the meadow, then the flavour.
    out.lerp(CREAM, smoothstep(0, 0.25, hill)).lerp(flavour, smoothstep(0.3, 0.6, hill));
  }
  // Caramel banks down to the chocolate, and the river bed under it.
  out.lerp(CARAMEL, smoothstep(0.9, 0.25, rise));
  out.lerp(BED, smoothstep(-0.1, -0.7, rise));
  // A faint sugar grain.
  return out.multiplyScalar(0.97 + 0.05 * hash(Math.round(x * 3), Math.round(z * 3)));
}

/** The ground: one grid over the land square, `step` metres apart, from `dreamHeight`, with the colours in the vertices. */
export function groundGeometry(land: DreamLand, step = 1.25): THREE.BufferGeometry {
  const cells = Math.max(2, Math.round((land.half * 2) / step));
  const geo = new THREE.PlaneGeometry(land.half * 2, land.half * 2, cells, cells).rotateX(-Math.PI / 2);
  const p = geo.getAttribute('position');
  const colours = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const h = dreamHeight(land, x, z);
    p.setY(i, h);
    groundColour(land, x, z, h, c);
    colours.set([c.r, c.g, c.b], i * 3);
  }
  // A soft shadow round the foot of each prop, so it sits on the ground.
  const per = cells + 1;
  for (const prop of land.props) {
    const r = SHADE_RADIUS[prop.kind] * prop.size * 1.4;
    const i0 = Math.max(0, Math.floor((prop.x - r + land.half) / ((land.half * 2) / cells)));
    const i1 = Math.min(cells, Math.ceil((prop.x + r + land.half) / ((land.half * 2) / cells)));
    const j0 = Math.max(0, Math.floor((prop.z - r + land.half) / ((land.half * 2) / cells)));
    const j1 = Math.min(cells, Math.ceil((prop.z + r + land.half) / ((land.half * 2) / cells)));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const k = j * per + i;
        const d = Math.hypot(p.getX(k) - prop.x, p.getZ(k) - prop.z);
        const f = 1 - 0.22 * smoothstep(r, r * 0.35, d);
        for (let a = 0; a < 3; a++) colours[k * 3 + a]! *= f;
      }
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geo.deleteAttribute('uv');
  geo.computeVertexNormals();
  return geo;
}

/** A milk chocolate swirl texture: curls of lighter and darker chocolate, repeating both ways. */
function swirlTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const c = canvas.getContext('2d');
  if (c) {
    c.fillStyle = `#${new THREE.Color(CHOCOLATE).getHexString()}`;
    c.fillRect(0, 0, size, size);
    const random = seeded(77);
    c.lineCap = 'round';
    for (let i = 0; i < 18; i++) {
      const light = i % 3 !== 0;
      c.strokeStyle = light ? 'rgba(150, 92, 54, 0.4)' : 'rgba(70, 36, 16, 0.3)';
      c.lineWidth = 4 + random() * 8;
      const x = random() * size;
      const y = random() * size;
      const r = 10 + random() * 26;
      const turn = random() * Math.PI * 2;
      // Draw each curl at its place and wrapped round, so the texture tiles.
      for (const dx of [-size, 0, size]) {
        for (const dy of [-size, 0, size]) {
          c.beginPath();
          for (let a = 0; a < Math.PI * 1.6; a += 0.15) {
            const rr = r * (1 - a / (Math.PI * 2.4));
            const px = x + dx + Math.cos(a + turn) * rr;
            const py = y + dy + Math.sin(a + turn) * rr * 1.8;
            if (a === 0) c.moveTo(px, py);
            else c.lineTo(px, py);
          }
          c.stroke();
        }
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Metres of river one repeat of the swirl texture covers, along and across. */
const SWIRL_ALONG = 10;
/** Points across the river's surface. */
const ACROSS = 5;

export interface ChocolateRiver {
  mesh: THREE.Mesh;
  /** Ripple the surface and let the swirl flow, at dream time `time`. */
  update(time: number): void;
  dispose(): void;
}

/** The chocolate's surface along the river, a little wider than the channel so it meets the caramel banks, and past both ends. */
export function createChocolateRiver(land: DreamLand): ChocolateRiver {
  const line = land.river.slice();
  if (line.length >= 2) {
    // Run on past the edges, under the hills, so the river never ends in sight.
    const ext = (a: { x: number; z: number }, b: { x: number; z: number }): { x: number; z: number } => {
      const d = Math.hypot(a.x - b.x, a.z - b.z) || 1;
      return { x: a.x + ((a.x - b.x) / d) * 30, z: a.z + ((a.z - b.z) / d) * 30 };
    };
    line.unshift(ext(line[0]!, line[1]!));
    line.push(ext(line[line.length - 1]!, line[line.length - 2]!));
  }
  const half = land.riverWidth / 2 + 1.2;
  const count = line.length * ACROSS;
  const pos = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  const along: number[] = [];
  let d = 0;
  line.forEach((p, i) => {
    if (i > 0) d += Math.hypot(p.x - line[i - 1]!.x, p.z - line[i - 1]!.z);
    along.push(d);
    const a = line[Math.max(0, i - 1)]!;
    const b = line[Math.min(line.length - 1, i + 1)]!;
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const nx = -(b.z - a.z) / len;
    const nz = (b.x - a.x) / len;
    for (let k = 0; k < ACROSS; k++) {
      const s = (k / (ACROSS - 1)) * 2 - 1;
      const v = i * ACROSS + k;
      pos.set([p.x + nx * s * half, CHOCOLATE_LEVEL, p.z + nz * s * half], v * 3);
      uv.set([(s * half) / SWIRL_ALONG, d / SWIRL_ALONG], v * 2);
    }
  });
  const index: number[] = [];
  for (let i = 0; i + 1 < line.length; i++) {
    for (let k = 0; k + 1 < ACROSS; k++) {
      const a = i * ACROSS + k;
      const b = a + ACROSS;
      index.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  const map = swirlTexture();
  const material = new THREE.MeshPhongMaterial({ color: 0xffffff, map, shininess: 70, specular: 0x6a4a36 });
  const mesh = new THREE.Mesh(geo, material);
  const position = geo.getAttribute('position') as THREE.BufferAttribute;
  return {
    mesh,
    update(time) {
      // A slow swell runs down the river, a little higher in the middle than at the banks.
      for (let i = 0; i < line.length; i++) {
        for (let k = 0; k < ACROSS; k++) {
          const s = (k / (ACROSS - 1)) * 2 - 1;
          const wave = 0.035 * Math.sin(along[i]! * 0.7 - time * 1.4 + s * 1.3) + 0.02 * Math.sin(along[i]! * 1.9 + time * 0.9 - s * 2);
          position.setY(i * ACROSS + k, CHOCOLATE_LEVEL + 0.02 + wave * (1 - 0.6 * s * s));
        }
      }
      position.needsUpdate = true;
      geo.computeVertexNormals();
      map.offset.set(0.02 * Math.sin(time * 0.3), -time * 0.09);
    },
    dispose() {
      geo.dispose();
      material.dispose();
      map.dispose();
    },
  };
}

/** The sky dome: soft blue overhead, lavender, then pink at the horizon and below it, the colour of the haze. */
export function skyDome(radius: number): THREE.Mesh {
  const geo = new THREE.SphereGeometry(radius, 32, 16);
  const p = geo.getAttribute('position');
  const colours = new Float32Array(p.count * 3);
  const top = new THREE.Color(SKY_TOP);
  const mid = new THREE.Color(SKY_MID);
  const low = new THREE.Color(DREAM_FOG);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const up = p.getY(i) / radius;
    c.copy(low).lerp(mid, smoothstep(0.02, 0.3, up)).lerp(top, smoothstep(0.25, 0.85, up));
    colours.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  mesh.renderOrder = -2;
  return mesh;
}

/** Cotton candy clouds in a ring far out: puffs of white, pink and lavender, flat underneath. One mesh. */
export function cloudRing(distance: number, seed: number): THREE.Mesh {
  const random = seeded(seed * 31 + 5);
  const tints = [0xffffff, 0xffe0ee, 0xece2ff, 0xfff2f7].map((c) => new THREE.Color(c));
  const parts: THREE.BufferGeometry[] = [];
  const count = 10;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + random() * 0.4;
    const r = distance * (0.85 + random() * 0.3);
    const cx = Math.cos(a) * r;
    const cz = Math.sin(a) * r;
    const cy = 45 + random() * 70;
    const big = 14 + random() * 10;
    const tint = tints[Math.floor(random() * tints.length)]!;
    const puffs = 5 + Math.floor(random() * 3);
    for (let k = 0; k < puffs; k++) {
      const t = puffs === 1 ? 0 : k / (puffs - 1) - 0.5;
      const s = big * (0.55 + 0.45 * Math.cos(t * Math.PI) + random() * 0.15);
      const g = new THREE.SphereGeometry(1, 10, 7);
      // Flatten the bottom half so the cloud sits on a level base.
      const gp = g.getAttribute('position');
      for (let j = 0; j < gp.count; j++) if (gp.getY(j) < -0.2) gp.setY(j, -0.2 - (gp.getY(j) + 0.2) * 0.25);
      g.computeVertexNormals();
      const along = t * big * 2.6;
      g.scale(s, s * 0.8, s).translate(cx - Math.sin(a) * along, cy + s * 0.25, cz + Math.cos(a) * along);
      parts.push(paint(g, () => tint));
    }
  }
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0xffe8f2, emissiveIntensity: 0.55, fog: false });
  const mesh = new THREE.Mesh(merge(parts), material);
  mesh.renderOrder = -1;
  return mesh;
}

/** Far ice cream mountains in a ring past the edge hills, big drippy scoops faded by the haze. One mesh. */
export function farScoops(land: DreamLand): THREE.Mesh {
  const random = seeded(land.seed * 13 + 7);
  const parts: THREE.BufferGeometry[] = [];
  const count = 12;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + random() * 0.2;
    const r = 36 + random() * 22;
    // Out to the square's corner and beyond, so the scoops ring the whole land.
    const reach = land.half * (1.25 + random() * 0.25) + r * 0.5;
    const colour = FLAVOURS[i % FLAVOURS.length]!.clone();
    const g = scoop(r, colour, random, 20, 12, true);
    parts.push(g.translate(Math.cos(a) * reach, -r * 0.35, Math.sin(a) * reach));
  }
  return new THREE.Mesh(merge(parts), new THREE.MeshLambertMaterial({ vertexColors: true }));
}

/**
 * Big scoops of ice cream along the crest of the edge hills on one side of the land (0 to 3: +x, +z, -x, -z), so the hills
 * read as heaps of ice cream with drips down their slopes. One mesh per side, so the sides behind the camera are not drawn.
 */
export function hillScoops(land: DreamLand, side: number): THREE.Mesh {
  const random = seeded(land.seed * 17 + side * 101 + 3);
  const parts: THREE.BufferGeometry[] = [];
  const spacing = 11;
  for (let u = -land.half; u <= land.half; u += spacing) {
    const r = 7 + random() * 3;
    const along = u + (random() - 0.5) * 3;
    const inward = land.half - 2 - random() * 3;
    const [x, z] = side === 0 ? [inward, along] : side === 1 ? [along, inward] : side === 2 ? [-inward, along] : [along, -inward];
    const colour = FLAVOURS[Math.floor(random() * FLAVOURS.length)]!;
    const g = scoop(r, colour, random, 14, 9, true);
    parts.push(g.scale(1, 0.8, 1).translate(x, dreamHeight(land, x, z), z));
  }
  // A soft glow keeps them bright on the side away from the sun.
  return new THREE.Mesh(merge(parts), new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0xfff0f6, emissiveIntensity: 0.18 }));
}

/** A soft round glow for the sun sprite. */
export function sunTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const c = canvas.getContext('2d');
  if (c) {
    const g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,250,1)');
    g.addColorStop(0.18, 'rgba(255,250,225,1)');
    g.addColorStop(0.24, 'rgba(255,236,200,0.5)');
    g.addColorStop(0.55, 'rgba(255,220,220,0.12)');
    g.addColorStop(1, 'rgba(255,220,230,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
