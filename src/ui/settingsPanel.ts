// The Settings panel and the achievements panel, the two buttons a player has at the top right besides "?" and the speaker.
// Settings holds the choices a player may want to change: the two volumes, the map, and the shadows. The achievements button
// opens the Things I did screen. DOM only; the caller owns the settings and the world.
import { GROUP_NAME, type AchievementGroup, type AchievementRow } from '../sim/achievements';

export interface SettingsOptions {
  /** Goes back to the start screen, where the saved games are (null when this run does not save). The caller saves first. */
  startScreen: (() => void) | null;
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
function cardWithButton(parent: HTMLElement, id: string, icon: string, label: string, right: number, title: string, onChange: (open: boolean) => void): { card: HTMLDivElement; body: HTMLDivElement; toggle(open: boolean): void; isOpen(): boolean } {
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
  return { card, body, toggle, isOpen: () => open };
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

  if (opts.startScreen) {
    const go = document.createElement('button');
    go.type = 'button';
    go.dataset.action = 'settings-start-screen';
    go.textContent = 'Start screen';
    go.style.cssText = CHOICE;
    const start = opts.startScreen;
    go.onclick = () => start();
    row('Saved games').appendChild(go);
    const more = document.createElement('div');
    more.textContent = 'Your game is saved first. Pick another game there, or come back to this one.';
    more.style.cssText = 'font-size:13px;color:#6b5d44;margin-top:4px';
    ui.body.appendChild(more);
  }

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

/** The most tiles of a row of the screen at once is set by the card's width; the card is wide so a tab of nine fits without scrolling. */
const TILE = 'display:flex;flex-direction:column;gap:4px;box-sizing:border-box;min-height:56px;padding:6px 10px;border-radius:10px;border:1px solid #b9a97d;font:inherit;text-align:left;cursor:pointer;color:#2a1f0e;';
const TAB = 'flex:1;min-height:44px;padding:4px 6px;font:inherit;font-size:14px;border-radius:8px;border:1px solid #b9a97d;color:#2a1f0e;cursor:pointer;';

/** The dots of a row's tiers (one for a single achievement): a filled one for each tier won. */
function medals(r: AchievementRow): string {
  return Array.from({ length: r.tiers }, (_, i) => (i < r.tier ? '\u25CF' : '\u25CB')).join('');
}

/**
 * The Things I did screen (#569): four tabs, a grid of tiles in the tab (a medal for each tier, the name, a bar and "17 of 30"),
 * and a strip above the grid with the hint of the tile last tapped, or pointed at with a mouse. A locked one is dim.
 */
export function createAchievementsPanel(parent: HTMLElement, rows: () => AchievementRow[]): AchievementsPanel {
  const summary = document.createElement('div');
  summary.dataset.role = 'achievement-summary';
  summary.style.cssText = 'font-size:14px;color:#6b5d44;margin:-4px 0 8px;';
  const tabs = document.createElement('div');
  tabs.style.cssText = 'display:flex;gap:6px;margin-bottom:8px;';
  tabs.setAttribute('role', 'tablist');
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(8.5rem,1fr));gap:8px;';
  const strip = document.createElement('div');
  strip.dataset.role = 'achievement-hint';
  strip.style.cssText = 'margin-bottom:8px;padding:6px 10px;min-height:2.8em;border-radius:10px;background:#ebe2c8;font-size:14px;';
  let timer: number | undefined;
  // A tap picks a tile and its hint stays in the strip until another is picked. A mouse also shows the hint while it is over a tile; a
  // finger leaves no hover, so only the tap counts there.
  let group: AchievementGroup = 'building';
  let picked = '';
  let hovered = '';
  let drawn = '';
  const showHint = (all: AchievementRow[]): void => {
    const r = all.find((x) => x.name === (hovered || picked));
    strip.textContent = r ? `${r.name}: ${r.hint}` : 'Tap one to see how to win it.';
  };
  const refresh = (): void => {
    const all = rows();
    const key = JSON.stringify([all, group, picked]);
    if (key === drawn) return;
    drawn = key;
    // The tiles are made again, so the one the mouse was on is gone and will not say it has left.
    hovered = '';
    const won = all.reduce((n, r) => n + r.tier, 0);
    summary.textContent = `${won} of ${all.reduce((n, r) => n + r.tiers, 0)} won`;
    tabs.replaceChildren(
      ...(Object.keys(GROUP_NAME) as AchievementGroup[]).map((g) => {
        const mine = all.filter((r) => r.group === g);
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.dataset.action = 'achievement-tab';
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-selected', String(g === group));
        tab.textContent = `${GROUP_NAME[g]} ${mine.reduce((n, r) => n + r.tier, 0)}/${mine.reduce((n, r) => n + r.tiers, 0)}`;
        tab.style.cssText = `${TAB}background:${g === group ? '#e3d6b0' : 'transparent'};font-weight:${g === group ? 700 : 400};`;
        tab.onclick = () => {
          group = g;
          refresh();
        };
        return tab;
      }),
    );
    grid.replaceChildren(
      ...all
        .filter((r) => r.group === group)
        .map((r) => {
          const tile = document.createElement('button');
          tile.type = 'button';
          tile.dataset.action = 'achievement';
          tile.setAttribute('aria-pressed', String(r.name === picked));
          const done = r.tier >= r.tiers;
          tile.style.cssText = `${TILE}background:${r.tier > 0 ? '#e3d6b0' : '#efe9d8'};${r.tier > 0 ? '' : 'opacity:.7;'}${r.name === picked ? 'outline:3px solid #7a5a2a;' : ''}`;
          const head = document.createElement('span');
          head.style.cssText = 'display:flex;justify-content:space-between;gap:6px;font-weight:600;';
          const name = document.createElement('span');
          name.textContent = r.name;
          const mark = document.createElement('span');
          mark.textContent = r.tiers > 1 ? medals(r) : r.tier > 0 ? '\u2713' : '\u25CB';
          mark.setAttribute('aria-label', `${r.tier} of ${r.tiers} won`);
          mark.style.cssText = 'color:#7a5a2a;white-space:nowrap;';
          head.append(name, mark);
          tile.append(head);
          if (r.progress) {
            const bar = document.createElement('span');
            bar.style.cssText = 'display:block;height:8px;border-radius:4px;background:#d8cfb5;overflow:hidden;';
            const fill = document.createElement('span');
            fill.style.cssText = `display:block;height:100%;background:#7a5a2a;width:${Math.round((100 * r.progress.have) / r.progress.need)}%;`;
            bar.append(fill);
            const count = document.createElement('span');
            count.textContent = `${r.progress.have} of ${r.progress.need}`;
            count.style.cssText = 'font-size:13px;color:#6b5d44;';
            tile.append(bar, count);
          } else if (done && r.tiers > 1) {
            const all3 = document.createElement('span');
            all3.textContent = 'All done';
            all3.style.cssText = 'font-size:13px;color:#6b5d44;';
            tile.append(all3);
          }
          tile.onclick = () => {
            picked = r.name === picked ? '' : r.name;
            refresh();
          };
          tile.onpointerenter = (e) => {
            if (e.pointerType !== 'mouse') return;
            hovered = r.name;
            showHint(all);
          };
          tile.onpointerleave = (e) => {
            if (e.pointerType !== 'mouse') return;
            if (hovered === r.name) hovered = '';
            showHint(all);
          };
          return tile;
        }),
    );
    showHint(all);
  };
  const ui = cardWithButton(parent, 'achievements', '\u{1F3C6}', 'Things I did', 232, 'Things I did', (open) => {
    window.clearInterval(timer);
    if (open) {
      drawn = '';
      refresh();
      // The counts move while the card is open, so it follows the world.
      timer = window.setInterval(refresh, 500);
    }
  });
  // A fixed width, so a long hint in the strip does not stretch the card.
  ui.card.style.width = 'min(44rem, 94vw)';
  ui.card.style.maxWidth = 'none';
  ui.body.append(summary, tabs, strip, grid);
  return { open: () => ui.toggle(true), close: () => ui.toggle(false) };
}
