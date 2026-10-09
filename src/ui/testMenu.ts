// Test menu: a small overlay for the author's tablet runs. Speed buttons, a
// jump to each location, and a readout of frame rate, tiles, triangles, and
// memory (M2, issue #52). DOM only; it asks the game to act through callbacks.

import { DAY_FRACTION, SEASONS, type Season } from '../sim/clock';
import { STAGES, type Stage } from '../sim/life';

export interface MenuLocation {
  id: string;
  name: string;
  /** False when the location has no tiles yet; its button is greyed out. */
  enabled: boolean;
}

export interface MenuReadout {
  fps: number;
  /** The beaver in local metres (x east, z south), the ground height under it, and the water over that ground. */
  beaver: { x: number; z: number; ground: number; waterDepth: number };
  /** Tiles held per level, or null without tiles. */
  tilesByLevel: number[] | null;
  triangles: number | null;
  /** Used JS heap in MB, where the browser reports it (Chrome and Android WebView). */
  memoryMb: number | null;
}

export type FlyMode = 'off' | 'map' | 'free';

export interface TestMenuOptions {
  speeds: number[];
  locations: MenuLocation[];
  onSpeed(multiplier: number): void;
  onJump(id: string): void;
  /** Test stand-in for entering and leaving a lodge (M4): the clock runs at half speed inside. */
  onLodge(inLodge: boolean): void;
  /** Take the lodge and its wear away, so a new one can be started (for instance in a pond). */
  onRemoveLodge(): void;
  /** Sleep through the night; only does something in the lodge at night. */
  onSleep(): void;
  /** Jump to a part of the day, 0 dawn to 1. */
  onTimeOfDay(timeOfDay: number): void;
  onSeason(season: Season): void;
  /** Make the beaver just reach a life stage now (baby, teenager, adult). */
  onStage(stage: Stage): void;
  /** Begin a new baby's life (Q34, Q40): new achievements, the old lodge and dams stay but win nothing. */
  onNewLife(): void;
  /** False when the game started without shadows (?shadows=0); the toggle is greyed out. */
  shadowsAvailable: boolean;
  onShadows(on: boolean): void;
  /** The view: the beaver's own, the map view (?fly=1) or the free drone (?fly=free). Picking another one restarts the game in it. */
  flyMode: { current: FlyMode; onSelect(mode: FlyMode): void };
  /** Debug marks for the scanned dam sites. Leave out when there is no scan file; the row is then not shown. */
  damSites?: { initiallyOn: boolean; onToggle(on: boolean): void };
  /** Dam test tools: jump to the nearest dam spot, and complete the dam at the spot the beaver stands at. Leave out when there are no spots. */
  damTools?: { onGo(): void; onFill(): void };
}

export interface TestMenu {
  /** Update the readout text. Cheap enough to call a few times a second. */
  setReadout(r: MenuReadout): void;
  /** The achievements list, one line each (`achievementLines`). */
  setAchievements(lines: string[]): void;
  setSpeed(multiplier: number): void;
  /** A short note under the readout, such as "Loading..." during a jump. */
  setStatus(text: string): void;
  toggle(): void;
}

export function formatReadout(r: MenuReadout): string {
  const tiles = r.tilesByLevel ? r.tilesByLevel.map((n, l) => `L${l} ${n ?? 0}`).join('  ') : 'none';
  const tris = r.triangles === null ? 'n/a' : `${Math.round(r.triangles / 1000)}k`;
  const mem = r.memoryMb === null ? 'n/a' : `${Math.round(r.memoryMb)} MB`;
  const b = r.beaver;
  const at = `x ${b.x.toFixed(0)}  z ${b.z.toFixed(0)}\nground ${b.ground.toFixed(2)} m\nwater ${b.waterDepth.toFixed(2)} m`;
  return `${Math.round(r.fps)} fps\n${at}\ntiles ${tiles}\ntriangles ${tris}\nmemory ${mem}`;
}

export function createTestMenu(parent: HTMLElement, opts: TestMenuOptions): TestMenu {
  const root = document.createElement('div');
  root.id = 'test-menu';
  root.style.cssText =
    'position:fixed;top:8px;right:8px;z-index:10;font:14px system-ui,sans-serif;color:#fff;text-align:right';

  const toggle = document.createElement('button');
  toggle.textContent = 'Test';
  toggle.setAttribute('aria-label', 'Test menu');
  const panel = document.createElement('div');
  panel.style.cssText =
    'display:none;margin-top:6px;padding:8px;background:rgba(0,0,0,.65);border-radius:8px;text-align:left;min-width:190px;max-height:calc(100vh - 70px);overflow-y:auto';

  const style = (b: HTMLButtonElement): void => {
    b.style.cssText = 'min-width:44px;min-height:44px;margin:2px;padding:4px 8px;font:inherit;border-radius:6px;border:1px solid #888;background:#2b3a2b;color:#fff';
  };
  style(toggle);

  const row = (label: string): HTMLDivElement => {
    const d = document.createElement('div');
    const l = document.createElement('div');
    l.textContent = label;
    l.style.marginTop = '6px';
    d.appendChild(l);
    panel.appendChild(d);
    return d;
  };

  const speedButtons = new Map<number, HTMLButtonElement>();
  const speedRow = row('Speed');
  for (const m of opts.speeds) {
    const b = document.createElement('button');
    b.textContent = `x${m}`;
    b.dataset.speed = String(m);
    style(b);
    b.onclick = () => opts.onSpeed(m);
    speedRow.appendChild(b);
    speedButtons.set(m, b);
  }

  // The achievements, a row that opens and closes (closed at first), near the top so it is easy to find.
  const achievementsRow = row('Achievements');
  const achievementsButton = document.createElement('button');
  achievementsButton.dataset.action = 'achievements';
  style(achievementsButton);
  achievementsButton.textContent = 'Show';
  const achievements = document.createElement('pre');
  achievements.style.cssText = 'display:none;margin:6px 0 0;font:12px ui-monospace,monospace;white-space:pre';
  achievementsButton.onclick = () => {
    const open = achievements.style.display === 'none';
    achievements.style.display = open ? 'block' : 'none';
    achievementsButton.textContent = open ? 'Hide' : 'Show';
  };
  achievementsRow.append(achievementsButton, achievements);

  const timeRow = row('Time of day');
  const parts: [string, number][] = [
    ['Dawn', 0.02],
    ['Morning', DAY_FRACTION * 0.2],
    ['Noon', DAY_FRACTION * 0.5],
    ['Evening', DAY_FRACTION * 0.9],
    ['Night', 0.8],
  ];
  for (const [name, t] of parts) {
    const b = document.createElement('button');
    b.textContent = name;
    b.dataset.time = name.toLowerCase();
    style(b);
    b.onclick = () => opts.onTimeOfDay(t);
    timeRow.appendChild(b);
  }
  const seasonRow = row('Season');
  for (const season of SEASONS) {
    const b = document.createElement('button');
    b.textContent = season[0]!.toUpperCase() + season.slice(1);
    b.dataset.season = season;
    style(b);
    b.onclick = () => opts.onSeason(season);
    seasonRow.appendChild(b);
  }
  const stageRow = row('Life stage');
  for (const stage of STAGES) {
    const b = document.createElement('button');
    b.textContent = stage[0]!.toUpperCase() + stage.slice(1);
    b.dataset.stage = stage;
    style(b);
    b.onclick = () => opts.onStage(stage);
    stageRow.appendChild(b);
  }
  const lifeButton = document.createElement('button');
  lifeButton.textContent = 'New baby';
  lifeButton.dataset.action = 'new-life';
  style(lifeButton);
  lifeButton.onclick = () => opts.onNewLife();
  stageRow.appendChild(lifeButton);
  const viewRow = row('View');
  const views: [FlyMode, string][] = [
    ['off', 'Beaver'],
    ['map', 'Map'],
    ['free', 'Drone'],
  ];
  for (const [mode, name] of views) {
    const b = document.createElement('button');
    b.textContent = name;
    b.dataset.fly = mode;
    style(b);
    if (mode === opts.flyMode.current) b.style.background = '#4f8a4f';
    b.onclick = () => {
      if (mode !== opts.flyMode.current) opts.flyMode.onSelect(mode);
    };
    viewRow.appendChild(b);
  }
  const lodgeRow = row('Lodge');
  const shadowRow = row('Shadows');
  const shadowButton = document.createElement('button');
  shadowButton.dataset.action = 'shadows';
  style(shadowButton);
  let shadowsOn = opts.shadowsAvailable;
  const showShadows = (): void => {
    shadowButton.textContent = shadowsOn ? 'On' : 'Off';
  };
  showShadows();
  shadowButton.disabled = !opts.shadowsAvailable;
  if (!opts.shadowsAvailable) shadowButton.style.opacity = '0.4';
  shadowButton.onclick = () => {
    shadowsOn = !shadowsOn;
    showShadows();
    opts.onShadows(shadowsOn);
  };
  shadowRow.appendChild(shadowButton);
  if (opts.damSites) {
    const damSites = opts.damSites;
    const damButton = document.createElement('button');
    damButton.dataset.action = 'damsites';
    style(damButton);
    let damOn = damSites.initiallyOn;
    const showDam = (): void => {
      damButton.textContent = damOn ? 'On' : 'Off';
    };
    showDam();
    damButton.onclick = () => {
      damOn = !damOn;
      showDam();
      damSites.onToggle(damOn);
    };
    row('Dam sites').appendChild(damButton);
  }
  if (opts.damTools) {
    const tools = opts.damTools;
    const go = document.createElement('button');
    go.textContent = 'To nearest spot';
    go.dataset.action = 'dam-go';
    style(go);
    go.onclick = () => tools.onGo();
    const fill = document.createElement('button');
    fill.textContent = 'Finish dam here';
    fill.dataset.action = 'dam-fill';
    style(fill);
    fill.onclick = () => tools.onFill();
    row('Dam').append(go, fill);
  }
  const lodgeButton = document.createElement('button');
  lodgeButton.dataset.action = 'lodge';
  style(lodgeButton);
  let inLodge = false;
  const showLodge = (): void => {
    lodgeButton.textContent = inLodge ? 'In lodge (half speed)' : 'Outside';
  };
  showLodge();
  lodgeButton.onclick = () => {
    inLodge = !inLodge;
    showLodge();
    opts.onLodge(inLodge);
  };
  const sleepButton = document.createElement('button');
  sleepButton.textContent = 'Sleep to dawn';
  sleepButton.dataset.action = 'sleep';
  style(sleepButton);
  sleepButton.onclick = () => opts.onSleep();
  const removeButton = document.createElement('button');
  removeButton.textContent = 'Remove lodge';
  removeButton.dataset.action = 'lodge-remove';
  style(removeButton);
  removeButton.onclick = () => {
    inLodge = false;
    showLodge();
    opts.onRemoveLodge();
  };
  lodgeRow.append(lodgeButton, sleepButton, removeButton);

  const jumpRow = row('Jump to');
  for (const loc of opts.locations) {
    const b = document.createElement('button');
    b.textContent = loc.name;
    b.dataset.location = loc.id;
    style(b);
    b.style.display = 'block';
    b.style.width = '100%';
    b.style.textAlign = 'left';
    b.disabled = !loc.enabled;
    if (!loc.enabled) b.style.opacity = '0.4';
    b.onclick = () => opts.onJump(loc.id);
    jumpRow.appendChild(b);
  }

  const readout = document.createElement('pre');
  readout.style.cssText = 'margin:8px 0 0;font:12px ui-monospace,monospace;white-space:pre';
  panel.appendChild(readout);
  const status = document.createElement('div');
  panel.appendChild(status);

  const flip = (): void => {
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  };
  toggle.onclick = flip;
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Backquote') flip();
  });

  root.append(toggle, panel);
  parent.appendChild(root);

  const menu: TestMenu = {
    setAchievements(lines) {
      const text = lines.join('\n');
      if (achievements.textContent !== text) achievements.textContent = text;
    },
    setReadout(r) {
      readout.textContent = formatReadout(r);
    },
    setSpeed(multiplier) {
      for (const [m, b] of speedButtons) b.style.background = m === multiplier ? '#4f8a4f' : '#2b3a2b';
    },
    setStatus(text) {
      status.textContent = text;
    },
    toggle: flip,
  };
  menu.setSpeed(1);
  return menu;
}
