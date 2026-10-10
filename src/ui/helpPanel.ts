// Help for a new player (the manual, public/manual.html): a "?" button at the top right that opens the manual over the
// game, and a welcome card the first time the game starts. DOM only. The manual is a plain page, shown in a frame so a
// tablet needs no browser chrome to get back to the game.

/** The key that remembers the welcome card was seen. */
export const WELCOME_KEY = 'beaver-cycle.welcomed';

/** The lines of the welcome card, for touch and for keys. */
export const WELCOME_LINES = {
  intro: 'You are a beaver in the Almsee valley. Nothing here can hurt you, and you cannot lose.',
  touch: 'Move with the stick, turn the view by dragging the empty screen. Gnaw a tree, drag the log, and build a dam at a white ring.',
  keys: 'Move with W A S D, turn the view by dragging the mouse. Press E at a tree to gnaw it, G to drag the log, and B to build at a white ring.',
  hint: 'The text at the top left always says what a button does right now.',
} as const;

/** Whether to show the welcome card: not seen before, not asked off with ?welcome=0, and not in an automated browser (it would block the tests). */
export function wantsWelcome(seen: boolean, query: URLSearchParams, automated: boolean): boolean {
  const asked = query.get('welcome');
  if (asked === '1') return true;
  if (asked === '0') return false;
  return !seen && !automated;
}

export interface HelpPanel {
  /** Open the manual over the game. */
  openManual(): void;
  /** Show the welcome card. */
  showWelcome(): void;
}

export interface HelpOptions {
  /** Where the manual page is, relative to the game page. */
  manualUrl: string;
  /** True on a touch device, which gets the touch wording. */
  touch: boolean;
  /** Called when the welcome card is closed, so the caller can remember it. */
  onWelcomed(): void;
}

const BUTTON = 'min-width:44px;min-height:44px;padding:8px 16px;border:0;border-radius:10px;font:16px system-ui,sans-serif;cursor:pointer;';

export function createHelpPanel(parent: HTMLElement, opts: HelpOptions): HelpPanel {
  const open = document.createElement('button');
  open.id = 'help-button';
  open.type = 'button';
  open.textContent = '?';
  open.setAttribute('aria-label', 'Open the manual');
  open.style.cssText = `${BUTTON}position:fixed;top:8px;right:76px;z-index:10;background:rgba(0,0,0,.55);color:#fff;font-weight:700;`;

  const manual = document.createElement('div');
  manual.id = 'manual';
  manual.setAttribute('role', 'dialog');
  manual.setAttribute('aria-label', 'Manual');
  manual.style.cssText = 'display:none;position:fixed;inset:0;z-index:30;flex-direction:column;background:#f6f1e4';
  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:#2f6a30;color:#fff;font:600 16px system-ui,sans-serif';
  const title = document.createElement('span');
  title.textContent = 'How to play';
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'Back to the game';
  close.dataset.action = 'manual-close';
  close.style.cssText = `${BUTTON}background:#f3e3b5;color:#2a1f0e;`;
  bar.append(title, close);
  const frame = document.createElement('iframe');
  frame.title = 'Beaver Cycle manual';
  frame.style.cssText = 'flex:1;border:0;width:100%';
  manual.append(bar, frame);

  const welcome = document.createElement('div');
  welcome.id = 'welcome';
  welcome.setAttribute('role', 'dialog');
  welcome.setAttribute('aria-label', 'Welcome');
  welcome.style.cssText =
    'display:none;position:fixed;inset:0;z-index:25;align-items:center;justify-content:center;background:rgba(0,0,0,.45);font:16px/1.5 system-ui,sans-serif';
  const card = document.createElement('div');
  card.style.cssText = 'box-sizing:border-box;max-width:min(30rem,92vw);max-height:92vh;overflow:auto;padding:18px 20px;border-radius:14px;background:#f6f1e4;color:#2a1f0e';
  const heading = document.createElement('div');
  heading.textContent = 'Welcome, little beaver';
  heading.style.cssText = 'font-size:22px;font-weight:700;margin-bottom:6px';
  const body = document.createElement('div');
  for (const text of [WELCOME_LINES.intro, opts.touch ? WELCOME_LINES.touch : WELCOME_LINES.keys, WELCOME_LINES.hint]) {
    const p = document.createElement('p');
    p.textContent = text;
    p.style.cssText = 'margin:6px 0';
    body.appendChild(p);
  }
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;margin-top:14px;justify-content:flex-end';
  const read = document.createElement('button');
  read.type = 'button';
  read.textContent = 'Read the manual';
  read.dataset.action = 'welcome-manual';
  read.style.cssText = `${BUTTON}background:#e3d6b0;color:#2a1f0e;`;
  const go = document.createElement('button');
  go.type = 'button';
  go.textContent = "Let's go";
  go.dataset.action = 'welcome-go';
  go.style.cssText = `${BUTTON}background:#2f6a30;color:#fff;`;
  row.append(read, go);
  card.append(heading, body, row);
  welcome.appendChild(card);

  parent.append(open, welcome, manual);

  const openManual = (): void => {
    // Load the page the first time it is asked for, so the game start does not wait for it.
    if (!frame.src) frame.src = opts.manualUrl;
    manual.style.display = 'flex';
  };
  const closeManual = (): void => {
    manual.style.display = 'none';
  };
  const closeWelcome = (): void => {
    welcome.style.display = 'none';
    opts.onWelcomed();
  };
  open.addEventListener('click', openManual);
  close.addEventListener('click', closeManual);
  read.addEventListener('click', () => {
    closeWelcome();
    openManual();
  });
  go.addEventListener('click', closeWelcome);
  // Escape closes whichever is open. The keys are for the game otherwise, so they are not read here.
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Escape') return;
    if (manual.style.display !== 'none') closeManual();
    else if (welcome.style.display !== 'none') closeWelcome();
  });

  return {
    openManual,
    showWelcome() {
      welcome.style.display = 'flex';
    },
  };
}
