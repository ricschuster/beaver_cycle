// The talk card: a prompt when a beaver is close enough to talk to ("Press Build to talk to Willow"), and then the beaver's name
// and what it says (docs/design/27_families_and_dialog.md, #344). A fixed card at the bottom centre, not a bubble above the
// head: that needs the screen position of the beaver and the renderer does not give one yet. DOM only.
export interface TalkBubble {
  /** Show the prompt for a speaker's name, or nothing when `name` is null. A line on screen is not replaced by a prompt. */
  prompt(name: string | null, key: string): void;
  /** Show what a beaver says, for `seconds`. */
  say(name: string, text: string, seconds: number): void;
  /** Counts down a line, call each frame. */
  tick(dt: number): void;
  /** True while a line is on screen. */
  talking(): boolean;
  /** Take a line off the screen at once. */
  hush(): void;
}

/** The text of the prompt, for a given button name. */
export const promptText = (name: string, key: string): string => `Press ${key} to talk to ${name}`;

export function createTalkBubble(parent: HTMLElement): TalkBubble {
  const root = document.createElement('div');
  root.id = 'talk-bubble';
  root.setAttribute('role', 'status');
  root.style.cssText =
    'position:fixed;left:50%;bottom:96px;transform:translateX(-50%);z-index:6;max-width:min(80vw,460px);padding:10px 18px;border-radius:14px;' +
    'background:rgba(255,250,235,.94);color:#2a2113;font:16px/1.35 system-ui,sans-serif;pointer-events:none;display:none;text-align:center';
  parent.appendChild(root);
  let left = 0;
  let line = false;
  const show = (html: string): void => {
    root.innerHTML = html;
    root.style.display = 'block';
  };
  const esc = (t: string): string => t.replace(/[&<>]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'));
  return {
    prompt(name, key) {
      if (line) return;
      if (name === null) root.style.display = 'none';
      else show(`<span style="opacity:.7">${esc(promptText(name, key))}</span>`);
    },
    say(name, text, seconds) {
      line = true;
      left = seconds;
      show(`<b>${esc(name)}</b><br>${esc(text)}`);
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
      root.style.display = 'none';
    },
  };
}
