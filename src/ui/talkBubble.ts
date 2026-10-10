// The talk card: a prompt when a beaver is close enough to talk to ("Press Build to talk to Willow"), and then the beaver's name
// and what it says (docs/design/27_families_and_dialog.md, #344). A fixed card at the bottom centre, not a bubble above the
// head: that needs the screen position of the beaver and the renderer does not give one yet. Under the name it says who the
// beaver is ("papa of the north pond"), and the card fades in and out. DOM only.
export interface TalkBubble {
  /** Show the prompt for a speaker's name, or nothing when `name` is null. A line on screen is not replaced by a prompt. */
  prompt(name: string | null, key: string): void;
  /** Show a plain note, such as the digging, or nothing when `text` is null. A line on screen is not replaced. */
  note(text: string | null): void;
  /**
   * Show what a beaver says, for `seconds`, with reply buttons that call `pick` with the button's id (none for a plain line), and
   * who the beaver is (`role`) in small letters under its name.
   */
  say(name: string, text: string, seconds: number, choices?: readonly Choice[], pick?: (id: string) => void, role?: string): void;
  /** Counts down a line, call each frame. */
  tick(dt: number): void;
  /** True while a line is on screen. */
  talking(): boolean;
  /** Take a line off the screen at once. */
  hush(): void;
}

/** A reply the player can tap. */
export interface Choice {
  id: string;
  label: string;
}

/** The text of the prompt, for a given button name. */
export const promptText = (name: string, key: string): string => `Press ${key} to talk to ${name}`;

/** Seconds the card takes to fade in and out. */
const FADE = 0.25;

export function createTalkBubble(parent: HTMLElement): TalkBubble {
  const root = document.createElement('div');
  root.id = 'talk-bubble';
  root.setAttribute('role', 'status');
  root.style.cssText =
    'position:fixed;left:50%;bottom:96px;transform:translateX(-50%);z-index:6;max-width:min(80vw,460px);padding:10px 18px;border-radius:14px;' +
    'background:rgba(255,250,235,.94);color:#2a2113;font:16px/1.35 system-ui,sans-serif;pointer-events:none;display:none;text-align:center;' +
    `opacity:0;transition:opacity ${FADE}s ease-out`;
  parent.appendChild(root);
  let left = 0;
  let line = false;
  let hideTimer: ReturnType<typeof setTimeout> | null = null;
  let shown = false;
  const show = (html: string): void => {
    root.innerHTML = html;
    if (hideTimer !== null) clearTimeout(hideTimer);
    hideTimer = null;
    if (shown) return;
    shown = true;
    root.style.display = 'block';
    // Read the layout once so the browser starts the fade from 0.
    void root.offsetWidth;
    root.style.opacity = '1';
  };
  const hide = (): void => {
    if (!shown) return;
    shown = false;
    root.style.opacity = '0';
    // A reply fading out cannot be tapped.
    for (const button of root.querySelectorAll('button')) button.disabled = true;
    hideTimer = setTimeout(() => {
      hideTimer = null;
      if (!shown) root.style.display = 'none';
    }, FADE * 1000);
  };
  const esc = (t: string): string => t.replace(/[&<>]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'));
  return {
    prompt(name, key) {
      if (line) return;
      if (name === null) hide();
      else show(`<span style="opacity:.7">${esc(promptText(name, key))}</span>`);
    },
    note(text) {
      if (line) return;
      if (text === null) hide();
      else show(`<span style="opacity:.8">${esc(text)}</span>`);
    },
    say(name, text, seconds, choices = [], pick, role) {
      line = true;
      left = seconds;
      const who = role ? `<div style="font-size:13px;opacity:.65">${esc(role)}</div>` : '';
      show(`<b>${esc(name)}</b>${who}<div style="margin-top:2px">${esc(text)}</div>`);
      if (choices.length === 0) return;
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-top:8px';
      for (const c of choices) {
        const b = document.createElement('button');
        b.textContent = c.label;
        b.style.cssText = 'pointer-events:auto;padding:10px 18px;min-height:44px;border:0;border-radius:10px;background:#7a4b22;color:#fff;font:16px system-ui,sans-serif;cursor:pointer';
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          pick?.(c.id);
        });
        row.appendChild(b);
      }
      root.appendChild(row);
    },
    tick(dt) {
      if (!line) return;
      left -= dt;
      if (left <= 0) this.hush();
    },
    talking: () => line,
    hush() {
      line = false;
      left = 0;
      hide();
    },
  };
}
