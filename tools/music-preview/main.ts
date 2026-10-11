// The game's generative music alone, through the same Web Audio code as the game (`createWebAudio`), with the ambient layers to switch on
// for judging the loudness. `npm run dev`, then open /tools/music-preview/. Query `?mood=dream` picks the mood to start with.
import { createWebAudio } from '../../src/audio/webAudio';
import { LAYERS } from '../../src/audio/sound';
import type { Layer } from '../../src/audio/soundOut';
import type { MusicColour, MusicMood } from '../../src/audio/music';

const out = createWebAudio();
let music = 0.5;
let effects = 0.5;
const layerOn = new Set<Layer>();
const push = (): void => out.setBuses(effects, music);

const moodButtons = new Map<MusicMood, HTMLButtonElement>();
const setMood = (m: MusicMood): void => {
  out.unlock();
  out.setMood(m);
  for (const [k, b] of moodButtons) b.classList.toggle('sel', k === m);
  const log = document.getElementById('log')!;
  log.textContent = m === 'off' ? 'Music off.' : `Playing the ${m} music. Notes begin a few seconds after the start.`;
};
for (const [m, name] of [['valley', 'Valley'], ['dream', 'Dream'], ['off', 'Off']] as const) {
  const b = document.createElement('button');
  b.textContent = name;
  b.onclick = () => setMood(m);
  moodButtons.set(m, b);
  document.getElementById('moods')!.append(b);
}

// Season and night colour of the valley music, as the game sets it from the clock.
const colour: MusicColour = { season: 'spring', night: false };
const colourButtons: HTMLButtonElement[] = [];
const showColour = (): void => {
  for (const b of colourButtons) b.classList.toggle('sel', b.dataset.season === colour.season || (b.dataset.night === '1') === colour.night && b.dataset.night !== undefined);
  out.setColour({ ...colour });
};
for (const season of ['spring', 'summer', 'autumn', 'winter'] as const) {
  const b = document.createElement('button');
  b.textContent = season;
  b.dataset.season = season;
  b.onclick = () => {
    colour.season = season;
    showColour();
  };
  colourButtons.push(b);
  document.getElementById('colours')!.append(b);
}
for (const [night, name] of [[false, 'day'], [true, 'night']] as const) {
  const b = document.createElement('button');
  b.textContent = name;
  b.dataset.night = night ? '1' : '0';
  b.onclick = () => {
    colour.night = night;
    showColour();
  };
  colourButtons.push(b);
  document.getElementById('colours')!.append(b);
}
showColour();

(document.getElementById('music') as HTMLInputElement).oninput = (e) => {
  music = Number((e.target as HTMLInputElement).value);
  push();
};
(document.getElementById('effects') as HTMLInputElement).oninput = (e) => {
  effects = Number((e.target as HTMLInputElement).value);
  push();
};

// Layers fade in at a full gain of 0.6, near the loudest the game plays them.
for (const layer of LAYERS) {
  const b = document.createElement('button');
  b.textContent = layer;
  b.onclick = () => {
    out.unlock();
    if (layerOn.has(layer)) layerOn.delete(layer);
    else layerOn.add(layer);
    out.setLayer(layer, layerOn.has(layer) ? 0.6 : 0);
    b.classList.toggle('sel', layerOn.has(layer));
  };
  document.getElementById('layers')!.append(b);
}

push();
const start = new URLSearchParams(location.search).get('mood');
if (start === 'valley' || start === 'dream') {
  // The browser blocks sound until a touch: start on the first one.
  const go = (): void => {
    setMood(start);
    window.removeEventListener('pointerdown', go);
  };
  window.addEventListener('pointerdown', go);
}
