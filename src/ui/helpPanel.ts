// Help for a new player (the manual, public/manual.html): a "?" button at the top right that opens the manual over the
// game, and a welcome card the first time the game starts. DOM only. The manual is a plain page, shown in a frame so a
// tablet needs no browser chrome to get back to the game.
import { t } from '../i18n';

/** The key that remembers the welcome card was seen. */
export const WELCOME_KEY = 'beaver-cycle.welcomed';

/** The lines of the welcome card, for touch and for keys, in the language set now. */
export function welcomeLines(): { intro: string; touch: string; keys: string; hint: string } {
  return { intro: t('welcome.intro'), touch: t('welcome.touch'), keys: t('welcome.keys'), hint: t('welcome.hint') };
}

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
  /** Called when the player asks for the first steps again from the manual bar. */
  onCoach(): void;
}

const BUTTON = 'min-width:44px;min-height:44px;padding:8px 16px;border:0;border-radius:10px;font:16px system-ui,sans-serif;cursor:pointer;';

export function createHelpPanel(parent: HTMLElement, opts: HelpOptions): HelpPanel {
  const open = document.createElement('button');
  open.id = 'help-button';
  open.type = 'button';
  open.textContent = '?';
  open.setAttribute('aria-label', t('help.open'));
  open.style.cssText = `${BUTTON}position:fixed;top:8px;right:76px;z-index:10;background:rgba(0,0,0,.55);color:#fff;font-weight:700;`;

  const manual = document.createElement('div');
  manual.id = 'manual';
  manual.setAttribute('role', 'dialog');
  manual.setAttribute('aria-label', t('help.manualLabel'));
  manual.style.cssText = 'display:none;position:fixed;inset:0;z-index:30;flex-direction:column;background:#f6f1e4';
  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:#2f6a30;color:#fff;font:600 16px system-ui,sans-serif';
  const title = document.createElement('span');
  title.textContent = t('help.title');
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = t('help.back');
  close.dataset.action = 'manual-close';
  close.style.cssText = `${BUTTON}background:#f3e3b5;color:#2a1f0e;`;
  const again = document.createElement('button');
  again.type = 'button';
  again.textContent = t('help.firstSteps');
  again.dataset.action = 'manual-coach';
  again.style.cssText = `${BUTTON}background:#e3d6b0;color:#2a1f0e;`;
  const buttons = document.createElement('span');
  buttons.style.cssText = 'display:flex;gap:10px';
  buttons.append(again, close);
  bar.append(title, buttons);
  const frame = document.createElement('iframe');
  frame.title = t('help.frameTitle');
  frame.style.cssText = 'flex:1;border:0;width:100%';
  manual.append(bar, frame);

  const welcome = document.createElement('div');
  welcome.id = 'welcome';
  welcome.setAttribute('role', 'dialog');
  welcome.setAttribute('aria-label', t('help.welcomeLabel'));
  welcome.style.cssText =
    'display:none;position:fixed;inset:0;z-index:25;align-items:center;justify-content:center;background:rgba(0,0,0,.45);font:16px/1.5 system-ui,sans-serif';
  const card = document.createElement('div');
  card.style.cssText = 'box-sizing:border-box;max-width:min(30rem,92vw);max-height:92vh;overflow:auto;padding:18px 20px;border-radius:14px;background:#f6f1e4;color:#2a1f0e';
  const heading = document.createElement('div');
  heading.textContent = t('help.welcome');
  heading.style.cssText = 'font-size:22px;font-weight:700;margin-bottom:6px';
  const body = document.createElement('div');
  const lines = welcomeLines();
  for (const text of [lines.intro, opts.touch ? lines.touch : lines.keys, lines.hint]) {
    const p = document.createElement('p');
    p.textContent = text;
    p.style.cssText = 'margin:6px 0';
    body.appendChild(p);
  }
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;margin-top:14px;justify-content:flex-end';
  const read = document.createElement('button');
  read.type = 'button';
  read.textContent = t('help.readManual');
  read.dataset.action = 'welcome-manual';
  read.style.cssText = `${BUTTON}background:#e3d6b0;color:#2a1f0e;`;
  const go = document.createElement('button');
  go.type = 'button';
  go.textContent = t('help.letsGo');
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
  again.addEventListener('click', () => {
    closeManual();
    opts.onCoach();
  });
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
