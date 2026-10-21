// How each dream looks (docs/design/29_dream_candy_land.md, docs/design/50_veggie_garden_dream.md): the colours of the haze,
// sky, light, river and hills, in one place so the scene code stays the same for candy land and the veggie garden.
import type { DreamLand, DreamTheme } from '../sim/dream';

export interface DreamLook {
  /** The haze and the bottom of the sky, so far hills melt into the sky. */
  fog: number;
  skyTop: number;
  skyMid: number;
  /** The light: sky and ground of the hemisphere light, and the sun. */
  hemiSky: number;
  hemiGround: number;
  sun: number;
  /** The river's liquid: its base colour, the lighter and darker curls in it, and the shine on it. */
  liquid: number;
  curlLight: string;
  curlDark: string;
  shine: number;
  /** Splash drops of the liquid. */
  drops: readonly [number, number];
  /** The ring of a splash. */
  ring: number;
  /** The hills' bands of colour (ice cream flavours, or garden greens), and the glow that keeps them bright. */
  flavours: readonly number[];
  hillGlow: number;
  /** The clouds' tints, and their glow. */
  clouds: readonly number[];
  cloudGlow: number;
}

export const LOOKS: Readonly<Record<DreamTheme, DreamLook>> = {
  candy: {
    fog: 0xfbd9e8,
    skyTop: 0x9fd0f6,
    skyMid: 0xd8c8f4,
    hemiSky: 0xfff6fb,
    hemiGround: 0xf3c3d6,
    sun: 0xfff0dc,
    liquid: 0x6b3b1f,
    curlLight: 'rgba(150, 92, 54, 0.4)',
    curlDark: 'rgba(70, 36, 16, 0.3)',
    shine: 0x6a4a36,
    drops: [0x6b3b1f, 0x8a5030],
    ring: 0x9a6038,
    flavours: [0xf9bcd0, 0xfff0cf, 0xc7f1de, 0xc9ddf8, 0xe0d0f6],
    hillGlow: 0xfff0f6,
    clouds: [0xffffff, 0xffe0ee, 0xece2ff, 0xfff2f7],
    cloudGlow: 0xffe8f2,
  },
  // A sunny garden: a warm green haze, a clear blue sky, carrot juice, and hills of cabbage green and wheat gold.
  veggie: {
    fog: 0xe4f1cf,
    skyTop: 0x86c5ee,
    skyMid: 0xcde8e0,
    hemiSky: 0xfffdf0,
    hemiGround: 0xc6dc9c,
    sun: 0xfff3d2,
    liquid: 0xf08a1f,
    curlLight: 'rgba(255, 190, 90, 0.45)',
    curlDark: 'rgba(190, 80, 10, 0.3)',
    shine: 0xa8601c,
    drops: [0xf08a1f, 0xffb050],
    ring: 0xf4a040,
    flavours: [0x9fd36a, 0xc9dc6c, 0x7fc15a, 0xdcc864, 0x8fcf7a],
    hillGlow: 0xf4ffe0,
    clouds: [0xffffff, 0xfffbe6, 0xf2fbe8, 0xffffff],
    cloudGlow: 0xfffbe6,
  },
};

export const lookOf = (land: Pick<DreamLand, 'theme'>): DreamLook => LOOKS[land.theme ?? 'candy'];
