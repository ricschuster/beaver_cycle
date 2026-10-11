// The open sound gaps: the code-made babble, and the clips staged by stage_gaps.py after round SETTLED (`round` in
// audio-candidates/index.json), so the settled sounds of /tools/sound-preview/ stay out of the way. Ratings are kept apart from that page and exported the same
// way, as markdown rows `cand:<file>`. `npm run dev`, then open /tools/sound-preview2/.
import { effectSamples } from '../../src/audio/effectsSynth';
import { SYNTH_RATE } from '../../src/audio/synth';
import { babbleCue } from '../../src/audio/talkDream';
import type { Effect } from '../../src/audio/effects';
const RATINGS = ['ok', 'thin', 'harsh', 'wrong'] as const;
type Rating = (typeof RATINGS)[number];
interface Note { rating?: Rating; note?: string }
interface Cand { file: string; source: string; round?: number }
// Rounds 1 to 5 are settled (fall, slap, pickup, chirp and babble too, session 93): their clips are in public/audio/ and no longer shown here.
const SETTLED = 5;
const KEY = 'sound-preview2-ratings';

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

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  e.textContent = text;
  if (cls) e.className = cls;
  return e;
};
const cell = (...children: HTMLElement[]): HTMLTableCellElement => {
  const td = el('td');
  td.append(...children);
  return td;
};

const vol = document.getElementById('vol') as HTMLInputElement;
let playing: HTMLAudioElement | undefined;

function row(c: Cand): HTMLTableRowElement {
  const audio = new Audio(`${import.meta.env.BASE_URL}audio-candidates/${c.file}`);
  return rateRow(`cand:${c.file}`, c.file.replace(/\.ogg$/, ''), () => {
    playing?.pause();
    playing = audio;
    audio.volume = Number(vol.value);
    audio.currentTime = 0;
    void audio.play();
  });
}

function rateRow(id: string, label: string, start: () => void): HTMLTableRowElement {
  const tr = el('tr');
  const play = el('button', label);
  play.onclick = start;
  const buttons = RATINGS.map((rating) => {
    const b = el('button', rating, `rate${rating === 'ok' ? '' : ' bad'}`);
    b.addEventListener('paint', () => b.classList.toggle('sel', notes[id]?.rating === rating));
    b.onclick = () => {
      notes[id] = { ...notes[id], rating: notes[id]?.rating === rating ? undefined : rating };
      save();
      for (const x of buttons) x.dispatchEvent(new Event('paint'));
    };
    b.dispatchEvent(new Event('paint'));
    return b;
  });
  const input = el('input');
  input.type = 'text';
  input.placeholder = 'note';
  input.value = notes[id]?.note ?? '';
  input.onchange = () => {
    notes[id] = { ...notes[id], note: input.value };
    save();
  };
  tr.append(cell(play), cell(...buttons), cell(input));
  return tr;
}

// The effects made in code that the author may still want a recording for (done and the chimes were rated ok and are settled, chirp has recordings), the gaps without a recording: play the current sound, rate it ok, or wrong to want a recording.
const SYNTH_GAPS: readonly Effect[] = [];
let ctx: AudioContext | undefined;
function playSynth(effect: Effect): void {
  playing?.pause();
  ctx ??= new AudioContext();
  void ctx.resume();
  const voice = effect === 'babble' ? babbleCue('mama', 'preview', 'Hello there, little one, come and see.').voice : undefined;
  const data = effectSamples(effect, SYNTH_RATE, voice);
  const buf = ctx.createBuffer(1, data.length, SYNTH_RATE);
  buf.copyToChannel(data, 0);
  const src = ctx.createBufferSource();
  const g = ctx.createGain();
  g.gain.value = Number(vol.value);
  src.buffer = buf;
  src.connect(g).connect(ctx.destination);
  src.start();
}

async function main(): Promise<void> {
  const groups = document.getElementById('groups')!;
  if (SYNTH_GAPS.length) {
    groups.append(el('h2', `made in code (${SYNTH_GAPS.length})`));
    const synthTable = el('table');
    synthTable.append(...SYNTH_GAPS.map((e) => rateRow(`synth:${e}`, `${e} (synth)`, () => playSynth(e))));
    groups.append(synthTable);
  } else groups.append(el('p', 'No open sound gaps: every effect is settled. Stage new candidates with stage_gaps.py (a round above SETTLED) to rate them here.'));
  let index: Record<string, Cand[]>;
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}audio-candidates/index.json`);
    if (!r.ok) throw new Error('missing');
    index = (await r.json()) as Record<string, Cand[]>;
  } catch {
    groups.textContent = 'No staged candidates here. Stage them with tools/sound-preview/stage_gaps.py.';
    return;
  }
  for (const [effect, list] of Object.entries(index)) {
    const fresh = list.filter((c) => (c.round ?? 0) > SETTLED);
    if (!fresh.length) continue;
    // An effect with new clips also lists its earlier ones, after the new, to rate them side by side.
    const older = list.filter((c) => (c.round ?? 0) <= SETTLED);
    groups.append(el('h2', `${effect} (${fresh.length} new, ${older.length} earlier)`));
    const t = el('table');
    t.append(...[...fresh, ...older].map(row));
    groups.append(t);
  }
}
void main();

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
