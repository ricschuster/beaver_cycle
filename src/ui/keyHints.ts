// Key hints for desktop play (issue #40): a small panel at the bottom left that
// lists the keys, shown when the device has no touch controls. H folds it away.
// E (Do) and G (Take) show what they do here, like the words on the touch
// buttons (#341). DOM only. The keys themselves are read in actions/keyboard.ts.

/** The keys and what they do, in the order shown. Keep in step with createKeyboardInput. */
export const KEY_HINTS: readonly (readonly [string, string])[] = [
  ['W A S D', 'swim and walk'],
  ['Space', 'dive (hold)'],
  ['T', 'tail slap'],
  ['E', 'do the thing at hand'],
  ['G', 'take, or drop'],
  ['Mouse drag', 'turn the view'],
  ['Wheel', 'zoom'],
  ['H', 'hide these hints'],
];

export interface KeyHints {
  /** Show or hide the whole panel (hidden on touch devices). */
  setVisible(visible: boolean): void;
  /** Fold the panel to one line, or open it again. */
  toggle(): void;
  /** What E (Do) and G (Take) do here, such as "Talk" and "Take", or null when a key does nothing here. */
  setWords(doWord: string | null, takeWord: string | null): void;
}

/** The line for one key: its word here, or "nothing here" when it does nothing. */
export function wordLine(key: string, word: string | null): string {
  return `<div><b>${key}</b> ${word ? word.toLowerCase() : '<span style="opacity:.6">nothing here</span>'}</div>`;
}

export function createKeyHints(parent: HTMLElement, target: Window, visible: boolean): KeyHints {
  const root = document.createElement('div');
  root.id = 'key-hints';
  root.style.cssText =
    'position:absolute;left:16px;bottom:16px;padding:10px 14px;border-radius:10px;background:rgba(0,0,0,.4);color:#fff;font:13px/1.5 system-ui,sans-serif;pointer-events:none;';
  const folded = '<div><b>H</b> show the keys</div>';
  let open = true;
  let shown = visible;
  let words: [string | null, string | null] | null = null;
  const full = (): string =>
    KEY_HINTS.map(([k, what]) => (words && k === 'E' ? wordLine(k, words[0]) : words && k === 'G' ? wordLine(k, words[1]) : `<div><b>${k}</b> ${what}</div>`)).join('');
  let drawn = '';
  const draw = (): void => {
    const html = open ? full() : folded;
    if (html !== drawn) root.innerHTML = drawn = html;
    root.style.display = shown ? 'block' : 'none';
  };
  draw();
  parent.appendChild(root);
  const toggle = (): void => {
    open = !open;
    draw();
  };
  target.addEventListener('keydown', (e) => {
    if (e.code === 'KeyH' && !e.repeat) toggle();
  });
  return {
    setVisible(v) {
      shown = v;
      draw();
    },
    toggle,
    setWords(doWord, takeWord) {
      if (words && words[0] === doWord && words[1] === takeWord) return;
      words = [doWord, takeWord];
      if (shown) draw();
    },
  };
}
