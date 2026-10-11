// The game's sound, put together (docs/design/32_sound.md): the settings, the layers, and a `SoundOut` to play them. The frame
// loop calls `update` with what the beaver can hear. No DOM here except the events that unlock the sound.

import { waterGain, windGain, birdsGain, cricketsGain, owlGain, effectsGain, musicGain, type Hearing } from './mix';
import { loadSound, saveSound, type SoundSettings } from './settings';
import type { Layer, SoundOut } from './soundOut';

export interface Sound {
  settings(): SoundSettings;
  setMuted(muted: boolean): void;
  setEffects(volume: number): void;
  setMusic(volume: number): void;
  /** Switch a layer on or off (a test menu switch). */
  setLayerOn(layer: Layer, on: boolean): void;
  layerOn(layer: Layer): boolean;
  /** Called every frame with what the beaver can hear. */
  update(h: Hearing): void;
}

export const LAYERS: readonly Layer[] = ['water', 'wind', 'birds', 'crickets', 'owl'];

const GAINS: Record<Layer, (h: Hearing) => number> = { water: waterGain, wind: windGain, birds: birdsGain, crickets: cricketsGain, owl: owlGain };

export function createSound(out: SoundOut, storage: Pick<Storage, 'getItem' | 'setItem'> | null): Sound {
  let s = loadSound(storage);
  const on = new Map<Layer, boolean>(LAYERS.map((l) => [l, true]));
  const push = (): void => out.setBuses(effectsGain(s), musicGain(s));
  const change = (next: SoundSettings): void => {
    s = next;
    saveSound(storage, s);
    push();
  };
  push();
  return {
    settings: () => s,
    setMuted: (muted) => change({ ...s, muted }),
    setEffects: (effects) => change({ ...s, effects: Math.min(1, Math.max(0, effects)) }),
    setMusic: (music) => change({ ...s, music: Math.min(1, Math.max(0, music)) }),
    setLayerOn: (layer, v) => {
      on.set(layer, v);
    },
    layerOn: (layer) => on.get(layer) ?? false,
    update(h) {
      for (const layer of LAYERS) out.setLayer(layer, on.get(layer) ? GAINS[layer](h) : 0);
    },
  };
}

/** Unlock the sound on the first touch or key, and stop it while the page is hidden. Returns a function that removes the listeners. */
export function wireBrowser(out: SoundOut, target: Window, doc: Document): () => void {
  const first = (): void => {
    out.unlock();
    if (out.running()) stop();
  };
  const events = ['pointerdown', 'touchend', 'keydown'] as const;
  const stop = (): void => {
    for (const e of events) target.removeEventListener(e, first);
  };
  for (const e of events) target.addEventListener(e, first);
  const hidden = (): void => out.setSuspended(doc.visibilityState === 'hidden');
  doc.addEventListener('visibilitychange', hidden);
  return () => {
    stop();
    doc.removeEventListener('visibilitychange', hidden);
  };
}
