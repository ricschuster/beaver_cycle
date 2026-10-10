// Key hints for desktop play (issue #40): a small panel at the bottom left that
// lists the keys, shown when the device has no touch controls. H folds it away.
// DOM only. The keys themselves are read in actions/keyboard.ts.

/** The keys and what they do, in the order shown. Keep in step with createKeyboardInput. */
export const KEY_HINTS: readonly (readonly [string, string])[] = [
  ['W A S D', 'swim and walk'],
  ['Space', 'dive (hold)'],
  ['T', 'tail slap'],
  ['E', 'gnaw'],
  ['G', 'drag a log, or let go'],
  ['B', 'build at the lodge'],
  ['Mouse drag', 'turn the view'],
  ['Wheel', 'zoom'],
  ['H', 'hide these hints'],
];

export interface KeyHints {
  /** Show or hide the whole panel (hidden on touch devices). */
  setVisible(visible: boolean): void;
  /** Fold the panel to one line, or open it again. */
  toggle(): void;
}

export function createKeyHints(parent: HTMLElement, target: Window, visible: boolean): KeyHints {
  const root = document.createElement('div');
  root.id = 'key-hints';
  root.style.cssText =
    'position:absolute;left:16px;bottom:16px;padding:10px 14px;border-radius:10px;background:rgba(0,0,0,.4);color:#fff;font:13px/1.5 system-ui,sans-serif;pointer-events:none;';
  const rows = KEY_HINTS.map(([k, what]) => `<div><b>${k}</b> ${what}</div>`).join('');
  const full = `<div>${rows}</div>`;
  const folded = '<div><b>H</b> show the keys</div>';
  let open = true;
  let shown = visible;
  const draw = (): void => {
    root.innerHTML = open ? full : folded;
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
  };
}
