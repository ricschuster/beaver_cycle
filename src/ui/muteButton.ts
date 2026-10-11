// The mute button (docs/design/32_sound.md): always on the screen, next to the "?" button. A press mutes or unmutes the game.
// DOM only; the caller owns the setting.

export interface MuteButton {
  /** Show the state: true for muted. */
  set(muted: boolean): void;
}

export function createMuteButton(parent: HTMLElement, muted: boolean, onToggle: () => void): MuteButton {
  const b = document.createElement('button');
  b.id = 'mute-button';
  b.type = 'button';
  b.style.cssText =
    'min-width:44px;min-height:44px;padding:8px;border:0;border-radius:10px;font:20px system-ui,sans-serif;cursor:pointer;position:fixed;top:8px;right:128px;z-index:10;background:rgba(0,0,0,.55);color:#fff';
  const set = (m: boolean): void => {
    b.textContent = m ? '\u{1F507}' : '\u{1F50A}';
    b.setAttribute('aria-label', m ? 'Sound is off, turn it on' : 'Sound is on, turn it off');
    b.setAttribute('aria-pressed', String(m));
  };
  set(muted);
  b.onclick = onToggle;
  parent.appendChild(b);
  return { set };
}
