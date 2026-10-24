// The picture over the head of a beaver that speaks to a friend (Q116, #802, docs/design/42_multiplayer.md): a round white bubble
// with a heart, a star, a question mark and so on, that pops up, bobs a moment and fades. Sprites that always face the camera, one
// per speaker, drawn on small canvases like the dream's effects. Reads state only.
import * as THREE from 'three';
import { PICTURES, type PictureId } from '../net/says';

/** One bubble to show: where the speaker's head is, which picture, and the seconds since it began. */
export interface Speech {
  x: number;
  y: number;
  z: number;
  picture: PictureId;
  age: number;
}

export interface SpeechView {
  /** Show these bubbles (none hides them all). */
  set(speeches: readonly Speech[]): void;
}

/** How long a bubble stays up (seconds), how fast it pops open, and how long it fades at the end. */
export const BUBBLE_LIFE = 3.5;
const POP = 0.25;
const FADE = 0.6;
/** Size (metres) and height above the speaker's feet. */
const SIZE = 0.9;
const HEIGHT = 1.9;
const MAX_BUBBLES = 8;

/** The scale (0 to 1.15) and opacity of a bubble of this age: it pops with a little overshoot, stays, and fades. */
export function bubbleLook(age: number): { scale: number; opacity: number } {
  if (age < 0 || age >= BUBBLE_LIFE) return { scale: 0, opacity: 0 };
  const grow = Math.min(1, age / POP);
  const scale = grow < 1 ? 1.15 * Math.sin((grow * Math.PI) / 2) : 1 + 0.15 * Math.max(0, 1 - (age - POP) / 0.2);
  const opacity = Math.min(1, (BUBBLE_LIFE - age) / FADE);
  return { scale, opacity };
}

function draw(c: CanvasRenderingContext2D, picture: PictureId): void {
  // The bubble: a white disc with a soft outline and a small tail at the bottom.
  c.fillStyle = 'rgba(255,255,255,0.96)';
  c.strokeStyle = 'rgba(70,90,110,0.8)';
  c.lineWidth = 5;
  c.beginPath();
  c.arc(64, 58, 48, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.beginPath();
  c.moveTo(52, 100);
  c.lineTo(64, 124);
  c.lineTo(76, 100);
  c.closePath();
  c.fill();
  c.beginPath();
  c.moveTo(52, 101);
  c.lineTo(64, 124);
  c.lineTo(76, 101);
  c.stroke();
  c.beginPath();
  c.moveTo(54, 99);
  c.lineTo(74, 99);
  c.strokeStyle = 'rgba(255,255,255,1)';
  c.lineWidth = 8;
  c.stroke();
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  if (picture === 'heart') {
    c.fillStyle = '#e8456b';
    c.beginPath();
    c.moveTo(64, 82);
    c.bezierCurveTo(30, 60, 36, 28, 56, 34);
    c.bezierCurveTo(60, 35, 63, 38, 64, 42);
    c.bezierCurveTo(65, 38, 68, 35, 72, 34);
    c.bezierCurveTo(92, 28, 98, 60, 64, 82);
    c.fill();
  } else if (picture === 'star') {
    c.fillStyle = '#f2b81c';
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? 30 : 13;
      c.lineTo(64 + Math.cos(a) * r, 58 + Math.sin(a) * r);
    }
    c.closePath();
    c.fill();
  } else if (picture === 'question' || picture === 'exclamation') {
    c.fillStyle = picture === 'question' ? '#3b86c4' : '#e0742a';
    c.font = 'bold 74px "Comic Sans MS", "Chalkboard SE", "Baloo 2", sans-serif';
    c.fillText(picture === 'question' ? '?' : '!', 64, 62);
  } else if (picture === 'note') {
    c.fillStyle = '#7b52b8';
    c.font = 'bold 70px "Comic Sans MS", "Chalkboard SE", sans-serif';
    c.fillText('♪', 64, 62);
  } else if (picture === 'drop') {
    c.fillStyle = '#3aa0d8';
    c.beginPath();
    c.moveTo(64, 26);
    c.bezierCurveTo(88, 54, 90, 64, 80, 76);
    c.bezierCurveTo(70, 86, 58, 86, 48, 76);
    c.bezierCurveTo(38, 64, 40, 54, 64, 26);
    c.fill();
  } else if (picture === 'branch') {
    c.strokeStyle = '#7a4e2a';
    c.lineWidth = 9;
    c.beginPath();
    c.moveTo(34, 78);
    c.lineTo(92, 40);
    c.stroke();
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(62, 60);
    c.lineTo(74, 76);
    c.moveTo(78, 50);
    c.lineTo(84, 32);
    c.stroke();
    c.fillStyle = '#5fae4a';
    c.beginPath();
    c.ellipse(88, 34, 8, 5, -0.6, 0, Math.PI * 2);
    c.ellipse(76, 80, 8, 5, 0.9, 0, Math.PI * 2);
    c.fill();
  } else {
    // smile
    c.fillStyle = '#f2c230';
    c.beginPath();
    c.arc(64, 58, 30, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#5a3a1a';
    c.beginPath();
    c.arc(54, 50, 4, 0, Math.PI * 2);
    c.arc(74, 50, 4, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#5a3a1a';
    c.lineWidth = 5;
    c.beginPath();
    c.arc(64, 60, 15, 0.2 * Math.PI, 0.8 * Math.PI);
    c.stroke();
  }
}

/** The texture of one picture, drawn once on a 128 pixel canvas. */
export function pictureTexture(picture: PictureId): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const c = canvas.getContext('2d');
  if (c) draw(c, picture);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createSpeechView(scene: THREE.Scene): SpeechView {
  const textures = new Map<PictureId, THREE.CanvasTexture>();
  const textureOf = (p: PictureId): THREE.CanvasTexture => {
    let t = textures.get(p);
    if (!t) {
      t = pictureTexture(p);
      textures.set(p, t);
    }
    return t;
  };
  const sprites: THREE.Sprite[] = [];
  for (let i = 0; i < MAX_BUBBLES; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, fog: false }));
    s.visible = false;
    s.renderOrder = 10;
    scene.add(s);
    sprites.push(s);
  }
  // Warm the textures so the first bubble does not hitch a frame.
  for (const p of PICTURES) textureOf(p);
  return {
    set(speeches) {
      sprites.forEach((s, i) => {
        const v = speeches[i];
        const look = v ? bubbleLook(v.age) : null;
        s.visible = !!v && !!look && look.opacity > 0;
        if (!v || !look || !s.visible) return;
        const mat = s.material as THREE.SpriteMaterial;
        const map = textureOf(v.picture);
        if (mat.map !== map) {
          mat.map = map;
          mat.needsUpdate = true;
        }
        mat.opacity = look.opacity;
        s.scale.setScalar(SIZE * look.scale);
        // The tail points down at the head, so the sprite's middle sits a little above it; it bobs gently.
        s.position.set(v.x, v.y + HEIGHT + 0.05 * Math.sin(v.age * 4) + 0.1 * look.scale, v.z);
      });
    },
  };
}
