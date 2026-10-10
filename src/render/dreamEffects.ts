// Little effects of the dream (docs/design/29_dream_candy_land.md): sparkles that fly up and fade when a sweet is taken,
// chocolate drops thrown up by a tail slap, the "hee hee" of a hidden marshmallow beaver, and the soft round shadow under
// a beaver. Textures are drawn on small canvases.
import * as THREE from 'three';

/** A canvas texture, drawn by `draw` on a `w` by `h` canvas. */
function canvasTexture(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext('2d');
  if (c) draw(c);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** A four pointed twinkle with a soft glow. */
export function sparkleTexture(): THREE.CanvasTexture {
  return canvasTexture(64, 64, (c) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.2, 'rgba(255,255,255,0.7)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
    c.fillStyle = 'rgba(255,255,255,1)';
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const r = i % 2 === 0 ? 31 : 5;
      c.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
    }
    c.fill();
  });
}

/** A soft round dot (a drop of chocolate, or a glow). */
export function dotTexture(): THREE.CanvasTexture {
  return canvasTexture(64, 64, (c) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
  });
}

/** The soft shadow under a beaver: dark in the middle, fading out to the edge. */
export function shadowTexture(): THREE.CanvasTexture {
  return canvasTexture(64, 64, (c) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(110,50,100,0.5)');
    g.addColorStop(0.6, 'rgba(110,50,100,0.26)');
    g.addColorStop(1, 'rgba(110,50,100,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
  });
}

/** "hee hee" in round pink letters with a white edge, for a hidden marshmallow beaver's giggle. */
export function giggleTexture(): THREE.CanvasTexture {
  return canvasTexture(256, 128, (c) => {
    c.font = 'bold 64px "Comic Sans MS", "Chalkboard SE", "Baloo 2", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    c.lineWidth = 14;
    c.strokeStyle = 'rgba(255,255,255,0.95)';
    c.strokeText('hee hee', 128, 66);
    c.fillStyle = '#e04790';
    c.fillText('hee hee', 128, 66);
  });
}

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  at: number;
  life: number;
  colour: THREE.Color;
}

export interface Particles {
  points: THREE.Points;
  /** Throw `n` particles from a point at dream time `time`, in the colours given, up at about `up` m/s and out at `out`. */
  emit(x: number, y: number, z: number, time: number, n: number, colours: readonly THREE.Color[], up: number, out: number, life: number): void;
  /** Move them to dream time `time`. */
  update(time: number): void;
  dispose(): void;
}

/**
 * A pool of `count` particles, drawn as one set of points with `texture`. They fly up and out, slow down, fall a little by
 * `gravity`, and fade. A new burst takes the oldest particles.
 */
export function createParticles(count: number, texture: THREE.Texture, size: number, gravity: number): Particles {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 4);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
  const material = new THREE.PointsMaterial({ size, map: texture, vertexColors: true, transparent: true, depthWrite: false });
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  const pool: Particle[] = [];
  let next = 0;
  let seed = 1;
  const random = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  return {
    points,
    emit(x, y, z, time, n, colours, up, out, life) {
      for (let i = 0; i < n; i++) {
        const a = random() * Math.PI * 2;
        const s = out * (0.4 + random() * 0.6);
        const p: Particle = { x, y, z, vx: Math.cos(a) * s, vy: up * (0.6 + random() * 0.6), vz: Math.sin(a) * s, at: time, life: life * (0.7 + random() * 0.5), colour: colours[i % colours.length]! };
        if (pool.length < count) pool.push(p);
        else pool[next] = p;
        next = (next + 1) % count;
      }
    },
    update(time) {
      col.fill(0);
      // With nothing flying the points are not drawn at all.
      points.visible = false;
      pool.forEach((p, i) => {
        const age = time - p.at;
        if (age < 0 || age > p.life) return;
        points.visible = true;
        // Air slows them: the distance flown tends to v / 2.5.
        const drift = (1 - Math.exp(-2.5 * age)) / 2.5;
        pos[i * 3] = p.x + p.vx * drift;
        pos[i * 3 + 1] = p.y + p.vy * drift - 0.5 * gravity * age * age;
        pos[i * 3 + 2] = p.z + p.vz * drift;
        const f = age / p.life;
        col.set([p.colour.r, p.colour.g, p.colour.b, Math.min(1, (1 - f) * 1.6)], i * 4);
      });
      geo.getAttribute('position').needsUpdate = true;
      geo.getAttribute('color').needsUpdate = true;
    },
    dispose() {
      geo.dispose();
      material.dispose();
    },
  };
}
