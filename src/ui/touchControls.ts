// Touch controls (M3, ADR 0005): a stick at the bottom left, and at the bottom
// right a held Dive, Slap, Take, and Do (#341, docs/design/30_buttons.md). Take and
// Do change their word with what they do here, and a button that can do nothing
// is greyed out in its place. DOM only. They produce the same Actions as the
// keyboard; dragging the empty view turns the camera (cameraRig). The breath bar
// sits at the bottom centre, so the buttons stay at the sides.

import { noActions, type Actions } from '../actions/actions';
import { stickMove, touchTuning } from '../actions/stick';

export interface TouchControls {
  /** Current actions. The slap fires once per press, so call this once per frame. */
  read(): Actions;
  /** Show or hide the controls. */
  setVisible(visible: boolean): void;
  /** Show or hide the beaver's buttons, keeping the stick (the free fly view has no use for them). */
  setActionsVisible(visible: boolean): void;
  /** The word on a button, such as Do reading "Talk". Only changes the page when the word does. */
  setLabel(button: TouchButton, label: string): void;
  /** Grey a button out when it can do nothing here, or bring it back. */
  setEnabled(button: TouchButton, enabled: boolean): void;
}

/** True on devices that report touch, or when the page asks for it with ?touch=1. */
export function wantsTouchControls(nav: Pick<Navigator, 'maxTouchPoints'>, query: URLSearchParams): boolean {
  return nav.maxTouchPoints > 0 || query.get('touch') === '1';
}

const GLASS = 'background:rgba(0,0,0,.35);border:2px solid rgba(255,255,255,.6);color:#fff;font:600 14px sans-serif;';

/** The beaver's buttons, by the action each one gives. */
export type TouchButton = 'dive' | 'slap' | 'take' | 'do';

export interface TouchOptions {
  /** Other labels for some buttons, or null to leave a button out (the dream shows Dive as Hop and has no Take). */
  labels?: Partial<Record<TouchButton, string | null>>;
  /** The start of the element ids, 'touch' by default, so a second set (the dream's) does not repeat the game's ids. */
  idPrefix?: string;
}

export function createTouchControls(parent: HTMLElement, visible: boolean, { labels = {}, idPrefix = 'touch' }: TouchOptions = {}): TouchControls {
  const { stickRadius, buttonSize } = touchTuning;
  const root = document.createElement('div');
  root.id = `${idPrefix}-controls`;
  root.style.cssText = `display:${visible ? 'block' : 'none'};position:fixed;inset:0;pointer-events:none;z-index:4;user-select:none;-webkit-user-select:none;`;

  const base = document.createElement('div');
  base.id = `${idPrefix}-stick`;
  const size = stickRadius * 2;
  base.style.cssText = `${GLASS}position:absolute;left:max(32px,env(safe-area-inset-left));bottom:48px;width:${size}px;height:${size}px;border-radius:50%;pointer-events:auto;touch-action:none;`;
  const knob = document.createElement('div');
  const knobSize = Math.round(stickRadius * 0.8);
  knob.style.cssText = `position:absolute;left:${stickRadius - knobSize / 2}px;top:${stickRadius - knobSize / 2}px;width:${knobSize}px;height:${knobSize}px;border-radius:50%;background:rgba(255,255,255,.55);`;
  base.appendChild(knob);

  const button = (id: TouchButton, name: string, right: string, bottom: string): HTMLButtonElement => {
    const b = document.createElement('button');
    const label = labels[id] ?? name;
    b.id = `${idPrefix}-${id}`;
    b.type = 'button';
    b.textContent = label;
    b.setAttribute('aria-label', label);
    b.style.cssText = `${GLASS}position:absolute;right:${right};bottom:${bottom};width:${buttonSize}px;height:${buttonSize}px;border-radius:50%;pointer-events:auto;touch-action:none;`;
    return b;
  };
  // Dive at the corner, Slap beside it, Do above Slap, and Take to their left, halfway up.
  const dive = button('dive', 'Dive', 'max(32px,env(safe-area-inset-right))', '48px');
  const slap = button('slap', 'Slap', `calc(max(32px,env(safe-area-inset-right)) + ${buttonSize + 20}px)`, '88px');
  const act = button('do', 'Do', `calc(max(32px,env(safe-area-inset-right)) + ${buttonSize + 20}px)`, `calc(88px + ${buttonSize + 12}px)`);
  const take = button('take', 'Take', `calc(max(32px,env(safe-area-inset-right)) + ${(buttonSize + 20) * 2}px)`, `calc(88px + ${Math.round((buttonSize + 12) / 2)}px)`);
  // A button labelled null is made but never shown, so it gives nothing.
  const buttons: Record<TouchButton, HTMLButtonElement> = { dive, slap, take, do: act };
  const shown = (Object.keys(buttons) as TouchButton[]).filter((k) => labels[k] !== null).map((k) => buttons[k]);
  root.append(base, ...shown);
  parent.appendChild(root);

  // The stick follows one finger, found by its pointer id, so a second finger
  // on a button or on the view does not disturb it.
  let stickId: number | null = null;
  let offset = { x: 0, y: 0 };
  const setKnob = (): void => {
    knob.style.transform = `translate(${offset.x}px,${offset.y}px)`;
  };
  const moveStick = (e: PointerEvent): void => {
    const r = base.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > stickRadius) {
      dx *= stickRadius / len;
      dy *= stickRadius / len;
    }
    offset = { x: dx, y: dy };
    setKnob();
  };
  const releaseStick = (e: PointerEvent): void => {
    if (e.pointerId !== stickId) return;
    stickId = null;
    offset = { x: 0, y: 0 };
    setKnob();
  };
  base.addEventListener('pointerdown', (e) => {
    if (stickId !== null) return;
    stickId = e.pointerId;
    base.setPointerCapture(e.pointerId);
    moveStick(e);
  });
  base.addEventListener('pointermove', (e) => {
    if (e.pointerId === stickId) moveStick(e);
  });
  base.addEventListener('pointerup', releaseStick);
  base.addEventListener('pointercancel', releaseStick);

  let diveId: number | null = null;
  const setDive = (id: number | null): void => {
    diveId = id;
    dive.style.background = id === null ? 'rgba(0,0,0,.35)' : 'rgba(127,208,239,.6)';
  };
  dive.addEventListener('pointerdown', (e) => {
    if (diveId !== null) return;
    dive.setPointerCapture(e.pointerId);
    setDive(e.pointerId);
  });
  const endDive = (e: PointerEvent): void => {
    if (e.pointerId === diveId) setDive(null);
  };
  dive.addEventListener('pointerup', endDive);
  dive.addEventListener('pointercancel', endDive);

  let slapped = false;
  slap.addEventListener('pointerdown', () => {
    slapped = true;
  });

  let acted = false;
  act.addEventListener('pointerdown', () => {
    acted = true;
  });

  let taken = false;
  take.addEventListener('pointerdown', () => {
    taken = true;
  });

  // The dive goes down once per press, for the water hole in the lodge, even while it stays held.
  let diveTapped = false;
  dive.addEventListener('pointerdown', () => {
    diveTapped = true;
  });

  // A long press on a button would open the browser's context menu.
  root.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    read() {
      const a = noActions();
      a.move = stickMove(offset.x, offset.y);
      // A press shorter than a frame still dives for one read, as on the keys.
      a.dive = diveId !== null || diveTapped;
      a.diveTap = diveTapped;
      diveTapped = false;
      a.slap = slapped;
      slapped = false;
      a.act = acted;
      acted = false;
      a.take = taken;
      taken = false;
      return a;
    },
    setVisible(v) {
      root.style.display = v ? 'block' : 'none';
    },
    setActionsVisible(v) {
      for (const b of shown) b.style.display = v ? '' : 'none';
    },
    setLabel(id, label) {
      const b = buttons[id];
      if (b.textContent === label) return;
      b.textContent = label;
      b.setAttribute('aria-label', label);
    },
    setEnabled(id, enabled) {
      const b = buttons[id];
      const opacity = enabled ? '' : '0.35';
      if (b.style.opacity === opacity) return;
      b.style.opacity = opacity;
      b.setAttribute('aria-disabled', String(!enabled));
    },
  };
}
