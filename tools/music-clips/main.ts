// Rate the staged music candidates (tools/music-clips/stage_music.py). Ratings stay in this browser and export as markdown rows `music:<file>`.
// `npm run dev`, then open /tools/music-clips/.
const RATINGS = ['ok', 'thin', 'harsh', 'wrong'] as const;
type Rating = (typeof RATINGS)[number];
interface Note { rating?: Rating; note?: string }
interface Clip { file: string; title: string; submitter: string; page: string; seconds: number; kb: number }
const KEY = 'music-clips-ratings';

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
vol.oninput = () => {
  if (playing) playing.volume = Number(vol.value);
};
document.getElementById('stop')!.onclick = () => playing?.pause();

function row(c: Clip): HTMLTableRowElement {
  const id = `music:${c.file}`;
  const tr = el('tr');
  const play = el('button', `${c.title} (${Math.floor(c.seconds / 60)}:${String(c.seconds % 60).padStart(2, '0')})`);
  const audio = new Audio(`${import.meta.env.BASE_URL}audio-candidates/${c.file}`);
  play.onclick = () => {
    playing?.pause();
    playing = audio;
    audio.volume = Number(vol.value);
    void audio.play();
  };
  const link = el('a', 'page');
  link.href = c.page;
  link.target = '_blank';
  link.style.color = '#9cd';
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
  tr.append(cell(play, el('small', ` ${c.kb} kB `), link), cell(...buttons), cell(input));
  return tr;
}

async function main(): Promise<void> {
  const list = document.getElementById('list')!;
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}audio-candidates/music/index.json`);
    if (!r.ok) throw new Error('missing');
    list.append(...((await r.json()) as Clip[]).map(row));
  } catch {
    list.textContent = 'No staged music. Run python3 tools/music-clips/stage_music.py WORK_DIR first.';
  }
}
void main();

const area = document.getElementById('out') as HTMLTextAreaElement;
document.getElementById('export')!.onclick = () => {
  const rows = Object.entries(notes).filter(([, n]) => n.rating || n.note);
  area.value = ['| sound | rating | note |', '|---|---|---|', ...rows.map(([id, n]) => `| ${id} | ${n.rating ?? ''} | ${n.note ?? ''} |`)].join('\n');
};
document.getElementById('copy')!.onclick = () => {
  area.select();
  void navigator.clipboard?.writeText(area.value);
};
