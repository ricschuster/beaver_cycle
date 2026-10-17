// The Settings panel and the achievements panel, the two buttons a player has at the top right besides "?" and the speaker.
// Settings holds the choices a player may want to change: the two volumes, the map, and the shadows. The achievements button
// opens the list of what has been won. DOM only; the caller owns the settings and the world.

export interface SettingsOptions {
  /** Both volumes 0 to 1, read when the panel opens. */
  sounds: { value(): number; onChange(v: number): void };
  music: { value(): number; onChange(v: number): void };
  /** The map: its mode in words, and a press moves to the next mode and says which. */
  map: { label(): string; onNext(): string };
  /** The shadows. Changing them restarts the game, so the caller saves first. */
  shadows: { on(): boolean; onToggle(on: boolean): void };
}

export interface SettingsPanel {
  open(): void;
  close(): void;
}

const BUTTON = 'min-width:44px;min-height:44px;padding:8px;border:0;border-radius:10px;font:20px system-ui,sans-serif;cursor:pointer;position:fixed;top:8px;z-index:10;background:rgba(0,0,0,.55);color:#fff;';
const CARD = 'display:none;position:fixed;top:60px;z-index:12;box-sizing:border-box;max-width:min(22rem,92vw);max-height:calc(100vh - 76px);overflow-y:auto;padding:14px 16px;border-radius:14px;background:#f6f1e4;color:#2a1f0e;font:16px/1.4 system-ui,sans-serif;';
const CHOICE = 'min-width:44px;min-height:44px;margin:2px 0;padding:6px 14px;font:inherit;border-radius:8px;border:1px solid #b9a97d;background:#e3d6b0;color:#2a1f0e;cursor:pointer;';

/** A round button at the top right that opens and closes a card. */
function cardWithButton(parent: HTMLElement, id: string, icon: string, label: string, right: number, title: string, onChange: (open: boolean) => void): { body: HTMLDivElement; toggle(open: boolean): void; isOpen(): boolean } {
  const button = document.createElement('button');
  button.id = `${id}-button`;
  button.type = 'button';
  button.textContent = icon;
  button.setAttribute('aria-label', label);
  button.style.cssText = `${BUTTON}right:${right}px;`;
  const card = document.createElement('div');
  card.id = id;
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', title);
  card.style.cssText = `${CARD}right:8px;`;
  const head = document.createElement('div');
  head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px';
  const heading = document.createElement('span');
  heading.textContent = title;
  heading.style.cssText = 'font-size:20px;font-weight:700';
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'Close';
  close.dataset.action = `${id}-close`;
  close.style.cssText = CHOICE;
  head.append(heading, close);
  const body = document.createElement('div');
  card.append(head, body);
  parent.append(button, card);
  let open = false;
  const toggle = (value: boolean): void => {
    open = value;
    card.style.display = open ? 'block' : 'none';
    button.setAttribute('aria-pressed', String(open));
    onChange(open);
  };
  button.onclick = () => toggle(!open);
  close.onclick = () => toggle(false);
  return { body, toggle, isOpen: () => open };
}

export function createSettingsPanel(parent: HTMLElement, opts: SettingsOptions): SettingsPanel {
  // The card is made first and `refresh` set after it, so the callback looks it up when it runs.
  let refresh = (): void => {};
  const ui = cardWithButton(parent, 'settings', '\u2699', 'Settings', 180, 'Settings', (open) => {
    if (open) refresh();
  });
  const row = (label: string): HTMLDivElement => {
    const d = document.createElement('div');
    d.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;margin:6px 0';
    const l = document.createElement('span');
    l.textContent = label;
    d.appendChild(l);
    ui.body.appendChild(d);
    return d;
  };
  const slider = (label: string, key: string, source: { value(): number; onChange(v: number): void }): HTMLInputElement => {
    const input = document.createElement('input');
    input.type = 'range';
    input.min = '0';
    input.max = '1';
    input.step = '0.05';
    input.dataset.action = `settings-${key}`;
    input.setAttribute('aria-label', label);
    input.style.cssText = 'width:140px;min-height:44px';
    input.oninput = () => source.onChange(Number(input.value));
    row(label).appendChild(input);
    return input;
  };
  const music = slider('Music', 'music', opts.music);
  const sounds = slider('Sounds', 'sounds', opts.sounds);

  const mapButton = document.createElement('button');
  mapButton.type = 'button';
  mapButton.dataset.action = 'settings-map';
  mapButton.style.cssText = CHOICE;
  mapButton.onclick = () => {
    mapButton.textContent = opts.map.onNext();
  };
  row('Map').appendChild(mapButton);

  const shadowButton = document.createElement('button');
  shadowButton.type = 'button';
  shadowButton.dataset.action = 'settings-shadows';
  shadowButton.style.cssText = CHOICE;
  const showShadows = (): void => {
    shadowButton.textContent = opts.shadows.on() ? 'On' : 'Off';
  };
  shadowButton.onclick = () => opts.shadows.onToggle(!opts.shadows.on());
  row('Shadows').appendChild(shadowButton);
  const note = document.createElement('div');
  note.textContent = 'Shadows look nice but slow some tablets down. Changing them starts the game again, where you left off.';
  note.style.cssText = 'font-size:13px;color:#6b5d44;margin-top:4px';
  ui.body.appendChild(note);

  refresh = (): void => {
    music.value = String(opts.music.value());
    sounds.value = String(opts.sounds.value());
    mapButton.textContent = opts.map.label();
    showShadows();
  };
  refresh();
  return { open: () => ui.toggle(true), close: () => ui.toggle(false) };
}

export interface AchievementsPanel {
  open(): void;
  close(): void;
}

/** What `achievementLines` writes for a line: "[x] Name" won, "[ ] Name 3/10" not yet. The panel draws a tick or a ring instead. */
export function prettyLine(line: string): string {
  if (line.startsWith('[x] ')) return `✓ ${line.slice(4)}`;
  if (line.startsWith('[ ] ')) return `○ ${line.slice(4)}`;
  return line;
}

export interface AchievementRow {
  line: string;
  hint: string;
}

export function createAchievementsPanel(parent: HTMLElement, rows: () => AchievementRow[]): AchievementsPanel {
  const list = document.createElement('div');
  let timer: number | undefined;
  // A tap opens the hint under its row and a second tap closes it. A mouse also shows it while it is over the row; a finger
  // leaves no hover, so only the tap counts there.
  const shown = new Set<number>();
  let hovered = -1;
  let drawn = '';
  let hints: HTMLElement[] = [];
  const showHints = (): void => hints.forEach((h, i) => (h.style.display = shown.has(i) || hovered === i ? 'block' : 'none'));
  const refresh = (): void => {
    const now = rows();
    const key = JSON.stringify(now);
    if (key === drawn) return;
    drawn = key;
    hints = [];
    list.replaceChildren(
      ...now.map((r, i) => {
        const item = document.createElement('div');
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.action = 'achievement';
        button.textContent = prettyLine(r.line);
        button.style.cssText = 'display:block;width:100%;min-height:36px;padding:4px 0;border:0;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer;';
        button.onclick = () => {
          if (!shown.delete(i)) shown.add(i);
          showHints();
        };
        item.onpointerenter = (e) => {
          if (e.pointerType !== 'mouse') return;
          hovered = i;
          showHints();
        };
        item.onpointerleave = (e) => {
          if (e.pointerType !== 'mouse') return;
          if (hovered === i) hovered = -1;
          showHints();
        };
        const hint = document.createElement('div');
        hint.dataset.role = 'achievement-hint';
        hint.textContent = r.hint;
        hint.style.cssText = 'display:none;margin:0 0 6px 18px;font-size:14px;color:#6b5d44;';
        hints.push(hint);
        item.append(button, hint);
        return item;
      }),
    );
    showHints();
  };
  const ui = cardWithButton(parent, 'achievements', '\u{1F3C6}', 'Things I did', 232, 'Things I did', (open) => {
    window.clearInterval(timer);
    if (open) {
      refresh();
      // The counts move while the card is open, so it follows the world.
      timer = window.setInterval(refresh, 500);
    }
  });
  ui.body.appendChild(list);
  return { open: () => ui.toggle(true), close: () => ui.toggle(false) };
}
