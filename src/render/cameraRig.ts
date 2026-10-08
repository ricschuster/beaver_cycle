// Third person camera control (ADR 0005): drag or touch to turn and tilt, wheel
// or pinch to zoom, and the view eases back behind the beaver while it walks.
// It holds view state only; the renderer places the camera from it.

export interface ViewState {
  /** Direction from the beaver to the camera, radians. PI is directly behind a beaver facing +z. */
  yaw: number;
  /** Height angle above the ground plane, radians. */
  pitch: number;
  /** Distance from the beaver in metres. */
  dist: number;
  /** A point the view orbits instead of the beaver (the fly view of the test URL), ground metres. Missing: the beaver. */
  focus?: { x: number; z: number };
}

export const MIN_PITCH = 0.04;
export const MAX_PITCH = 1.3;
export const MIN_DIST = 3;
export const MAX_DIST = 30;
/** Seconds after the last drag before the view swings back behind a walking beaver. */
const FOLLOW_DELAY = 1.5;
/** Per second easing rate of that swing. */
const FOLLOW_RATE = 1.35;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

export const defaultView = (): ViewState => ({ yaw: Math.PI, pitch: 0.34, dist: 6.5 });

/** Apply a drag in pixels to the view. */
export function drag(v: ViewState, dx: number, dy: number): void {
  v.yaw = wrap(v.yaw - dx * 0.006);
  v.pitch = clamp(v.pitch + dy * 0.004, MIN_PITCH, MAX_PITCH);
}

export function zoom(v: ViewState, factor: number, maxDist = MAX_DIST): void {
  v.dist = clamp(v.dist * factor, MIN_DIST, maxDist);
}

/** Ease the yaw toward the spot behind the beaver. Pure on its numbers. */
export function followYaw(yaw: number, heading: number, dt: number): number {
  return wrap(yaw + wrap(heading + Math.PI - yaw) * Math.min(1, dt * FOLLOW_RATE));
}

export interface CameraRig {
  view: ViewState;
  /** Call once per frame with the beaver's heading and whether it is moving. */
  update(dt: number, heading: number, moving: boolean): void;
}

export interface RigOptions {
  /** How far out the view may zoom (the fly view of the test URL lifts it). */
  maxDist?: number;
  /** When given, a one-finger drag calls this with the pixels dragged instead of turning the view (the fly view slides the map). */
  pan?: (dx: number, dy: number) => void;
}

export function createCameraRig(el: HTMLElement, { maxDist = MAX_DIST, pan }: RigOptions = {}): CameraRig {
  const view = defaultView();
  let idle = FOLLOW_DELAY;
  const pointers = new Map<number, { x: number; y: number }>();
  let pinch = 0;

  el.style.touchAction = 'none';
  el.addEventListener('pointerdown', (e) => {
    el.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    pinch = 0;
  });
  el.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    idle = 0;
    if (pointers.size === 1) {
      if (pan) pan(dx, dy);
      else drag(view, dx, dy);
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch > 0 && d > 0) zoom(view, pinch / d, maxDist);
      pinch = d;
    }
  });
  const up = (e: PointerEvent): void => {
    pointers.delete(e.pointerId);
    pinch = 0;
  };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      zoom(view, Math.exp(e.deltaY * 0.001), maxDist);
      idle = 0;
    },
    { passive: false },
  );

  return {
    view,
    update(dt, heading, moving) {
      idle += dt;
      if (moving && idle > FOLLOW_DELAY) view.yaw = followYaw(view.yaw, heading, dt);
    },
  };
}
