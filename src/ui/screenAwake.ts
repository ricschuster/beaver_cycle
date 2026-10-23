// Keeps the screen on while the game is in front, so the tablet does not go dark between touches (#771). The Screen Wake Lock API
// does it; the browser lets go of the lock by itself when the page is hidden, so it is asked for again when the page shows. After
// IDLE_MS without a touch or a key the lock is let go, so a tablet left alone goes to sleep as the system says; the next touch takes
// it back. Browsers without the API (or a page that is not a secure context) simply keep the system timeout.

/** Milliseconds without input after which the screen may sleep again. */
export const IDLE_MS = 10 * 60 * 1000;

interface Sentinel {
  release(): Promise<void>;
}

export interface ScreenAwakeEnv {
  /** `navigator.wakeLock`, or undefined where the browser has none. */
  wakeLock: { request(type: 'screen'): Promise<Sentinel> } | undefined;
  hidden(): boolean;
  /** Calls back on every touch, pointer move or key. */
  onInput(cb: () => void): void;
  onVisibility(cb: () => void): void;
  setTimeout(cb: () => void, ms: number): number;
  clearTimeout(id: number): void;
}

export interface ScreenAwake {
  /** The Settings choice: on holds the screen while the game is played, off leaves the system timeout. */
  setEnabled(on: boolean): void;
}

export function createScreenAwake(env: ScreenAwakeEnv, enabled: boolean, idleMs = IDLE_MS): ScreenAwake {
  let on = enabled;
  let idle = false;
  let held: Sentinel | null = null;
  let asking = false;
  let timer: number | undefined;

  const wanted = (): boolean => on && !idle && !env.hidden();
  const sync = (): void => {
    if (!env.wakeLock) return;
    if (!wanted()) {
      const h = held;
      held = null;
      h?.release().catch(() => {});
      return;
    }
    if (held || asking) return;
    asking = true;
    env.wakeLock
      .request('screen')
      .then((s) => {
        asking = false;
        // The wish may have gone while the browser was answering.
        if (wanted() && !held) held = s;
        else s.release().catch(() => {});
      })
      .catch(() => {
        // Refused (low battery, a hidden page): the next input or showing of the page tries again.
        asking = false;
      });
  };
  const arm = (): void => {
    env.clearTimeout(timer ?? 0);
    timer = env.setTimeout(() => {
      idle = true;
      sync();
    }, idleMs);
  };
  env.onInput(() => {
    arm();
    if (idle) idle = false;
    sync();
  });
  // The browser drops the lock when the page hides, so forget it and ask again on showing.
  env.onVisibility(() => {
    held = null;
    sync();
  });
  arm();
  sync();
  return {
    setEnabled(value) {
      on = value;
      sync();
    },
  };
}

/** The real thing, on the page. */
export function startScreenAwake(enabled: boolean): ScreenAwake {
  return createScreenAwake(
    {
      wakeLock: (navigator as Navigator & { wakeLock?: ScreenAwakeEnv['wakeLock'] }).wakeLock,
      hidden: () => document.hidden,
      onInput(cb) {
        for (const type of ['pointerdown', 'pointermove', 'keydown']) window.addEventListener(type, cb, { passive: true, capture: true });
      },
      onVisibility(cb) {
        document.addEventListener('visibilitychange', cb);
      },
      setTimeout: (cb, ms) => window.setTimeout(cb, ms),
      clearTimeout: (id) => window.clearTimeout(id),
    },
    enabled,
  );
}
