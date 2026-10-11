// Round 3 of the sound candidates: only the clips staged by stage_gaps.py for the gaps (`round: 3` in audio-candidates/index.json),
// so the settled sounds of /tools/sound-preview/ stay out of the way. Ratings are kept apart from that page and exported the same
// way, as markdown rows `cand:<file>`. `npm run dev`, then open /tools/sound-preview2/.
const RATINGS = ['ok', 'thin', 'harsh', 'wrong'] as const;
type Rating = (typeof RATINGS)[number];
interface Note { rating?: Rating; note?: string }
interface Cand { file: string; source: string; round?: number }
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
  const id = `cand:${c.file}`;
  const tr = el('tr');
  const audio = new Audio(`${import.meta.env.BASE_URL}audio-candidates/${c.file}`);
  const play = el('button', c.file.replace(/\.ogg$/, ''));
  play.onclick = () => {
    playing?.pause();
    playing = audio;
    audio.volume = Number(vol.value);
    audio.currentTime = 0;
    void audio.play();
  };
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

async function main(): Promise<void> {
  const groups = document.getElementById('groups')!;
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
    const fresh = list.filter((c) => c.round === 3);
    if (!fresh.length) continue;
    groups.append(el('h2', `${effect} (${fresh.length})`));
    const t = el('table');
    t.append(...fresh.map(row));
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
