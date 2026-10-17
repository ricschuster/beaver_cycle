// Every text of the game with its German beside it, to read, correct and mark as reviewed (docs/design/36_languages.md).
// `npm run dev`, then open /tools/text-review/. Edits and ticks are kept in this browser (localStorage); Export downloads
// `de.ts` and `reviewed.de.json` for `src/i18n/`. A tick holds a hash of the English, so it falls back to "not reviewed"
// when the English changes after the review.
import { en } from '../../src/i18n/en';

type Entry = string | readonly string[];
const english = en as unknown as Readonly<Record<string, Entry>>;
const KEYS = Object.keys(english);

// The committed German and review marks, if the files exist yet.
const deFiles = import.meta.glob<{ de: Record<string, Entry> }>('../../src/i18n/de.ts', { eager: true });
const reviewedFiles = import.meta.glob<{ default: Record<string, number> }>('../../src/i18n/reviewed.de.json', { eager: true });
const committedDe: Record<string, Entry> = Object.values(deFiles)[0]?.de ?? {};
const committedReviewed: Record<string, number> = Object.values(reviewedFiles)[0]?.default ?? {};

const STORE = 'text-review.de.v1';
interface Work {
  de: Record<string, Entry>;
  reviewed: Record<string, number>;
}
const load = (): Work => {
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) return JSON.parse(raw) as Work;
  } catch {
    // Storage blocked or damaged: start from the committed files.
  }
  return { de: { ...committedDe }, reviewed: { ...committedReviewed } };
};
const work = load();
const save = (): void => {
  try {
    localStorage.setItem(STORE, JSON.stringify(work));
  } catch {
    // Not kept.
  }
};

/** A small hash of the English of a key, to notice when it changes after a review. */
const hashOf = (key: string): number => {
  let h = 2166136261;
  for (const ch of JSON.stringify(english[key])) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
};
const lines = (e: Entry | undefined): string[] => (e === undefined ? [] : typeof e === 'string' ? [e] : [...e]);
const isList = (key: string): boolean => typeof english[key] !== 'string';
const status = (key: string): 'missing' | 'todo' | 'changed' | 'done' => {
  if (work.de[key] === undefined) return 'missing';
  const r = work.reviewed[key];
  return r === undefined ? 'todo' : r === hashOf(key) ? 'done' : 'changed';
};

const esc = (s: string): string => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
const marked = (s: string): string => esc(s).replace(/\{(\w+)\}/g, '<mark>{$1}</mark>');

const list = document.getElementById('list')!;
const count = document.getElementById('count')!;
const filter = document.getElementById('filter') as HTMLSelectElement;
const search = document.getElementById('search') as HTMLInputElement;

const groupOf = (key: string): string => key.split('.').slice(0, 2).join('.');

function shown(key: string): boolean {
  const f = filter.value;
  const st = status(key);
  if (f === 'todo' && st === 'done') return false;
  if (f === 'changed' && st !== 'changed') return false;
  if (f === 'missing' && st !== 'missing') return false;
  const q = search.value.trim().toLowerCase();
  if (!q) return true;
  return [key, ...lines(english[key]), ...lines(work.de[key])].some((s) => s.toLowerCase().includes(q));
}

function row(key: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'row';
  const k = document.createElement('div');
  k.className = 'key';
  k.textContent = key;
  const e = document.createElement('div');
  e.className = 'en';
  for (const l of lines(english[key])) {
    const d = document.createElement('div');
    d.innerHTML = marked(l) || '&nbsp;';
    e.appendChild(d);
  }
  const de = document.createElement('div');
  de.className = 'de';
  const have = lines(work.de[key]);
  const want = lines(english[key]).length;
  for (let i = 0; i < Math.max(want, 1); i++) {
    if (want === 0) break;
    const ta = document.createElement('textarea');
    ta.value = have[i] ?? '';
    ta.rows = Math.max(1, Math.ceil((lines(english[key])[i]?.length ?? 20) / 48));
    if (work.de[key] === undefined) ta.classList.add('missing');
    ta.addEventListener('input', () => {
      const next = [...de.querySelectorAll('textarea')].map((t) => (t as HTMLTextAreaElement).value);
      work.de[key] = isList(key) ? next : next[0] ?? '';
      delete work.reviewed[key];
      ta.classList.remove('missing');
      save();
      paintCount();
    });
    de.appendChild(ta);
  }
  const ok = document.createElement('label');
  ok.className = 'ok';
  const box = document.createElement('input');
  box.type = 'checkbox';
  const st = status(key);
  box.checked = st === 'done';
  box.disabled = st === 'missing';
  box.addEventListener('change', () => {
    if (box.checked) work.reviewed[key] = hashOf(key);
    else delete work.reviewed[key];
    save();
    paintCount();
  });
  ok.append(box, document.createTextNode('Reviewed'));
  if (st === 'changed') {
    const c = document.createElement('span');
    c.className = 'changed';
    c.textContent = 'English changed';
    ok.appendChild(c);
  }
  el.append(k, e, de, ok);
  return el;
}

function paintCount(): void {
  const done = KEYS.filter((k) => status(k) === 'done').length;
  const missing = KEYS.filter((k) => status(k) === 'missing').length;
  count.textContent = `Reviewed ${done} of ${KEYS.length}` + (missing ? `, ${missing} without German` : '');
}

function paint(): void {
  list.replaceChildren();
  let group = '';
  const frag = document.createDocumentFragment();
  for (const key of KEYS) {
    if (!shown(key)) continue;
    const g = groupOf(key);
    if (g !== group) {
      group = g;
      const h = document.createElement('h2');
      h.textContent = g;
      frag.appendChild(h);
    }
    frag.appendChild(row(key));
  }
  list.appendChild(frag);
  paintCount();
}

const q = (s: string): string => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
function download(name: string, text: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

document.getElementById('export-de')!.addEventListener('click', () => {
  const out = KEYS.filter((k) => work.de[k] !== undefined).map((k) => {
    const v = work.de[k]!;
    return `  ${q(k)}: ${typeof v === 'string' ? q(v) : `[${v.map(q).join(', ')}]`},`;
  });
  download('de.ts', `// German (docs/design/36_languages.md). Written by tools/text-review; the English keys are in en/.\nimport type { Table } from './en';\n\nexport const de: Partial<Table> = {\n${out.join('\n')}\n};\n`);
});
document.getElementById('export-reviewed')!.addEventListener('click', () => {
  const marks = Object.fromEntries(KEYS.filter((k) => status(k) === 'done').map((k) => [k, work.reviewed[k]]));
  download('reviewed.de.json', `${JSON.stringify(marks, null, 1)}\n`);
});
const file = document.getElementById('import-file') as HTMLInputElement;
document.getElementById('import')!.addEventListener('click', () => file.click());
file.addEventListener('change', async () => {
  const f = file.files?.[0];
  if (!f) return;
  const text = await f.text();
  try {
    const marks = JSON.parse(text) as Record<string, number>;
    Object.assign(work.reviewed, marks);
    save();
    paint();
  } catch {
    alert('That file is not a reviewed.de.json.');
  }
});
filter.addEventListener('change', paint);
search.addEventListener('input', paint);
paint();
