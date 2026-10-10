// Touch controls (M3, ADR 0005): a stick at the bottom left, a held dive button
// and a tail slap button at the bottom right. DOM only. They produce the same
// Actions as the keyboard; dragging the empty view turns the camera (cameraRig).
// The breath bar sits at the bottom centre, so the buttons stay at the sides.

import { noActions, type Actions } from '../actions/actions';
import { stickMove, touchTuning } from '../actions/stick';

export interface TouchControls {
  /** Current actions. The slap fires once per press, so call this once per frame. */
  read(): Actions;
  /** Show or hide the controls. */
  setVisible(visible: boolean): void;
  /** Show or hide the beaver's buttons, keeping the stick (the free fly view has no use for them). */
  setActionsVisible(visible: boolean): void;
}

/** True on devices that report touch, or when the page asks for it with ?touch=1. */
export function wantsTouchControls(nav: Pick<Navigator, 'maxTouchPoints'>, query: URLSearchParams): boolean {
  return nav.maxTouchPoints > 0 || query.get('touch') === '1';
}

const GLASS = 'background:rgba(0,0,0,.35);border:2px solid rgba(255,255,255,.6);color:#fff;font:600 14px sans-serif;';

/** The beaver's buttons, by the action each one gives. */
export type TouchButton = 'dive' | 'slap' | 'chop' | 'grab' | 'build';

export interface TouchOptions {
  /** Other labels for some buttons, or null to leave a button out (the dream shows Dive as Hop and has no Gnaw). */
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
  const dive = button('dive', 'Dive', 'max(32px,env(safe-area-inset-right))', '48px');
  const slap = button('slap', 'Slap', `calc(max(32px,env(safe-area-inset-right)) + ${buttonSize + 20}px)`, '88px');
  const chop = button('chop', 'Gnaw', `calc(max(32px,env(safe-area-inset-right)) + ${buttonSize + 20}px)`, `calc(88px + ${buttonSize + 12}px)`);
  const grab = button('grab', 'Drag', `calc(max(32px,env(safe-area-inset-right)) + ${(buttonSize + 20) * 2}px)`, '88px');
  const build = button('build', 'Build', `calc(max(32px,env(safe-area-inset-right)) + ${(buttonSize + 20) * 2}px)`, `calc(88px + ${buttonSize + 12}px)`);
  // A button labelled null is made but never shown, so it gives nothing.
  const buttons = { dive, slap, chop, grab, build };
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

  let chopped = false;
  chop.addEventListener('pointerdown', () => {
    chopped = true;
  });

  let grabbed = false;
  grab.addEventListener('pointerdown', () => {
    grabbed = true;
  });

  let built = false;
  build.addEventListener('pointerdown', () => {
    built = true;
  });

  // A long press on a button would open the browser's context menu.
  root.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    read() {
      const a = noActions();
      a.move = stickMove(offset.x, offset.y);
      a.dive = diveId !== null;
      a.slap = slapped;
      slapped = false;
      a.chop = chopped;
      chopped = false;
      a.grab = grabbed;
      grabbed = false;
      a.build = built;
      built = false;
      return a;
    },
    setVisible(v) {
      root.style.display = v ? 'block' : 'none';
    },
    setActionsVisible(v) {
      for (const b of shown) b.style.display = v ? '' : 'none';
    },
  };
}
