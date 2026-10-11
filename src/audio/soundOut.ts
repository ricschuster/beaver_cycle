// Where sound goes (docs/design/32_sound.md). The game talks to this small interface, the tests to a fake, and the browser
// to Web Audio (webAudio.ts). Nothing in `sim/` imports this.

/** The ambient loops. */
export type Layer = 'water' | 'wind' | 'birds' | 'crickets' | 'owl';

export interface SoundOut {
  /** Set the volumes of the two buses, 0 to 1. */
  setBuses(effects: number, music: number): void;
  /** Set how loud an ambient loop is, 0 to 1. A layer switched off is silent. */
  setLayer(layer: Layer, gain: number): void;
  /** Stop all sound while the game is in the background, and carry on when it is back. */
  setSuspended(suspended: boolean): void;
  /** Start the sound once the browser allows it (the first touch or key). Safe to call again. */
  unlock(): void;
  /** True once sound can play. */
  running(): boolean;
}

/** A stand-in that only records what it was told, for tests. */
export function fakeSoundOut(): SoundOut & { effects: number; music: number; layers: Map<Layer, number>; suspended: boolean; unlocked: boolean } {
  const out = {
    effects: 0,
    music: 0,
    layers: new Map<Layer, number>(),
    suspended: false,
    unlocked: false,
    setBuses(e: number, m: number) {
      out.effects = e;
      out.music = m;
    },
    setLayer(layer: Layer, gain: number) {
      out.layers.set(layer, gain);
    },
    setSuspended(s: boolean) {
      out.suspended = s;
    },
    unlock() {
      out.unlocked = true;
    },
    running: () => out.unlocked && !out.suspended,
  };
  return out;
}
