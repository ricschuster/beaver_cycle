// Every sound of the game on one page, to listen to and rate (docs/design/32_sound.md, "Checking sound"). It plays through the
// same Web Audio code as the game (`createWebAudio`), with the measurements of each sound beside it. Ratings are kept in
// localStorage and exported as markdown for the session notes. `npm run dev`, then open /tools/sound-preview/ (on a tablet too).
import { createWebAudio } from '../../src/audio/webAudio';
import { analyze, wavBytes } from '../../src/audio/analyze';
import { effectSamples } from '../../src/audio/effectsSynth';
import { birdsLoop, cricketsLoop, owlLoop, SYNTH_RATE } from '../../src/audio/synth';
import { DURATION, type Effect } from '../../src/audio/effects';
import { LAYERS } from '../../src/audio/sound';
import type { Layer } from '../../src/audio/soundOut';

const out = createWebAudio();
const RATINGS = ['ok', 'thin', 'harsh', 'wrong'] as const;
type Rating = (typeof RATINGS)[number];
interface Note { rating?: Rating; note?: string }
const KEY = 'sound-preview-ratings';

let notes: Record<string, Note> = {};
try {
  notes = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, Note>;
} catch {
  notes = {};
}
const save = (): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(notes));
  } catch {
    // Not kept: the page still works.
  }
};

let volume = 0.8;
let gain = 0.7;
const unlock = (): void => {
  out.unlock();
  out.setBuses(volume, 0);
};

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  e.textContent = text;
  if (cls) e.className = cls;
  return e;
};

/** The rating buttons and the note box of one sound. */
function rateCells(id: string): HTMLTableCellElement[] {
  const r = el('td');
  const buttons = RATINGS.map((rating) => {
    const b = el('button', rating, `rate${rating === 'ok' ? '' : ' bad'}`);
    const paint = (): void => {
      b.classList.toggle('sel', notes[id]?.rating === rating);
    };
    b.onclick = () => {
      notes[id] = { ...notes[id], rating: notes[id]?.rating === rating ? undefined : rating };
      save();
      for (const x of buttons) x.dispatchEvent(new Event('paint'));
    };
    b.addEventListener('paint', paint);
    paint();
    return b;
  });
  r.append(...buttons);
  const n = el('td');
  const input = el('input');
  input.type = 'text';
  input.placeholder = 'note';
  input.value = notes[id]?.note ?? '';
  input.onchange = () => {
    notes[id] = { ...notes[id], note: input.value };
    save();
  };
  n.append(input);
  return [r, n];
}

const download = (name: string, samples: Float32Array): void => {
  const a = el('a');
  a.href = URL.createObjectURL(new Blob([wavBytes(samples, SYNTH_RATE)], { type: 'audio/wav' }));
  a.download = `${name}.wav`;
  a.click();
  URL.revokeObjectURL(a.href);
};

const stats = (s: Float32Array): string => {
  const a = analyze(s, SYNTH_RATE);
  return `${a.seconds.toFixed(2)} s · ${a.rmsDb.toFixed(0)} dB · ${Math.round(a.centroid)} Hz`;
};

// The bar: volume and the gain of a cue, and the pitch of a babble.
const bar = document.getElementById('bar')!;
const slider = (label: string, value: number, set: (v: number) => void): void => {
  const l = el('label', `${label} `);
  const i = el('input');
  i.type = 'range';
  i.min = '0';
  i.max = '1';
  i.step = '0.05';
  i.value = String(value);
  i.oninput = () => {
    set(Number(i.value));
  };
  l.append(i);
  bar.append(l);
};
slider('volume', volume, (v) => {
  volume = v;
  unlock();
});
slider('cue gain', gain, (v) => {
  gain = v;
});
const stop = el('button', 'stop layers', 'stop');
bar.append(stop);

// Ambient layers: a loop is on or off at the gain of the slider. Water and wind are noise through filters, so they have no stats.
const layersTable = document.getElementById('layers')!;
const loops: Partial<Record<Layer, Float32Array>> = { birds: birdsLoop(), crickets: cricketsLoop(), owl: owlLoop() };
const layerOn = new Set<Layer>();
const paintLayers: (() => void)[] = [];
for (const layer of LAYERS) {
  const tr = el('tr');
  const b = el('button', layer);
  const paint = (): void => {
    b.classList.toggle('on', layerOn.has(layer));
    out.setLayer(layer, layerOn.has(layer) ? gain : 0);
  };
  paintLayers.push(paint);
  b.onclick = () => {
    unlock();
    if (layerOn.has(layer)) layerOn.delete(layer);
    else layerOn.add(layer);
    paint();
  };
  const loop = loops[layer];
  tr.append(el('td').appendChild(b).parentElement!, el('td', loop ? stats(loop) : 'made from noise in the browser', 'num'), ...rateCells(`layer:${layer}`));
  if (loop) {
    const dl = el('button', 'wav');
    dl.onclick = () => download(`loop-${layer}`, loop);
    tr.append(el('td').appendChild(dl).parentElement!);
  }
  layersTable.append(tr);
}
stop.onclick = () => {
  layerOn.clear();
  for (const p of paintLayers) p();
};

// One-shots: tap to play. A babble has three presets for the speakers (kit, mama, papa).
const table = document.getElementById('effects')!;
const heads = el('tr');
for (const h of ['', 'length · loudness · brightness', 'rating', 'note', '']) heads.append(el('th', h));
table.append(heads);
const effects = Object.keys(DURATION) as Effect[];
for (const e of effects) {
  const variants: { id: string; label: string; voice?: { pitch: number; seconds: number; seed: number } }[] =
    e === 'babble'
      ? [
          { id: 'babble:kit', label: 'babble kit', voice: { pitch: 560, seconds: 1.2, seed: 3 } },
          { id: 'babble:mama', label: 'babble mama', voice: { pitch: 320, seconds: 1.2, seed: 5 } },
          { id: 'babble:papa', label: 'babble papa', voice: { pitch: 190, seconds: 1.2, seed: 9 } },
        ]
      : [{ id: e, label: e }];
  for (const v of variants) {
    const samples = effectSamples(e, SYNTH_RATE, v.voice);
    const tr = el('tr');
    const b = el('button', v.label);
    b.onclick = () => {
      unlock();
      out.play(e, gain, v.voice);
    };
    const dl = el('button', 'wav');
    dl.onclick = () => download(v.id.replace(':', '-'), samples);
    tr.append(el('td').appendChild(b).parentElement!, el('td', stats(samples), 'num'), ...rateCells(v.id), el('td').appendChild(dl).parentElement!);
    table.append(tr);
  }
}

// Export: the ratings as markdown, worst first, so the next session can start from them.
const area = document.getElementById('out') as HTMLTextAreaElement;
const order = (r?: Rating): number => (r ? RATINGS.indexOf(r) + 1 : 0);
document.getElementById('export')!.onclick = () => {
  const rows = Object.entries(notes)
    .filter(([, n]) => n.rating || n.note)
    .sort(([, a], [, b]) => order(b.rating) - order(a.rating));
  area.value = ['| sound | rating | note |', '|---|---|---|', ...rows.map(([id, n]) => `| ${id} | ${n.rating ?? ''} | ${n.note ?? ''} |`)].join('\n');
};
document.getElementById('copy')!.onclick = () => {
  area.select();
  void navigator.clipboard?.writeText(area.value);
};
