// Test menu: a small overlay for the author's tablet runs. Speed buttons, a
// jump to each location, and a readout of frame rate, tiles, triangles, and
// memory (M2, issue #52). DOM only; it asks the game to act through callbacks.

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

export interface TestMenuOptions {
  speeds: number[];
  locations: MenuLocation[];
  onSpeed(multiplier: number): void;
  onJump(id: string): void;
}

export interface TestMenu {
  /** Update the readout text. Cheap enough to call a few times a second. */
  setReadout(r: MenuReadout): void;
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
