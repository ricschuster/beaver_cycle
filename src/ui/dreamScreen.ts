// The dream screen (docs/design/29_dream_candy_land.md): candy land over the whole game, with the sweet count, the game's status,
// short lines for what happens, the prompt for a game, touch buttons of its own, and Wake up. It owns the dream's state, steps
// it with the player's actions, and draws it with the dream's own scene. The waking game stands still while it is open (main.ts).

import { mergeActions, noActions, relativeToView, type Actions } from '../actions/actions';
import { createCameraRig, type CameraRig } from '../render/cameraRig';
import { createDreamView, type DreamView } from '../render/dreamView';
import { newDream, playPrompt, stepDream, type DreamEvent, type DreamInput, type DreamState } from '../sim/dream';
import { DARK_MS, FADE_MS } from './sleepPrompt';
import { createTouchControls, type TouchControls } from './touchControls';

export interface DreamScreen {
  /** Open a new dream from a seed. Does nothing while a dream is open. */
  start(seed: number): void;
  /** One frame of the dream: step it with the actions, draw it, and update the screen. */
  frame(dt: number, actions: Actions): void;
  /** True from `start` until the screen has faded out after Wake up. */
  active(): boolean;
  /** The dream as it is now, or null when none is open (for tests). */
  state(): DreamState | null;
}

export interface DreamScreenOptions {
  /** Called once when the player wakes, as the screen starts to fade out over the dark. */
  onWake(): void;
  /** Show the dream's own touch buttons, else a line with the keys. */
  touch: boolean;
}

/** Seconds a line stays, and less when more wait behind it. At most this many wait. */
const LINE_SECONDS = 2.6;
const LINE_SECONDS_BUSY = 1.4;
const LINE_QUEUE = 3;

/** The dream's input from the player's actions: the move turned to the view, and a hop only on the frame Dive goes down. */
export function dreamInput(actions: Actions, yaw: number, diveBefore: boolean): DreamInput {
  return { move: relativeToView(actions.move, yaw), hop: !!actions.dive && !diveBefore, slap: !!actions.slap, play: !!actions.act };
}

/** A marshmallow beaver's name from an event, which may carry its id or its name. 'player' stays 'player'. */
export function mallowName(state: DreamState, who: string): string {
  return state.mallows.find((m) => m.id === who)?.name ?? who;
}

const pick = (lines: readonly string[], n: number): string => lines[Math.abs(Math.floor(n)) % lines.length]!;

/** The line for an event, picked from a few by the counter `n`, or null for events that need none (a sweet, a splash, a giggle). */
export function dreamLine(event: DreamEvent, state: DreamState, n: number): string | null {
  switch (event.what) {
    case 'sweet':
      return event.kind === 'star' ? pick(['A golden star!', 'Ooh, a shiny star!', 'You found a star!'], n) : null;
    case 'rush':
      return pick(['Sugar rush!', 'Zoom! Sugar rush!', 'Whee! Sugar rush!'], n);
    case 'greet': {
      const name = mallowName(state, event.who);
      return pick([`${name} says hello!`, `${name} waves hi!`, `${name} hops over to say hi!`, `Hello from ${name}!`], n);
    }
    case 'tagStart': {
      if (event.it === 'player') return pick(['Tag! You are it. Catch someone!', 'Tag! You are it!'], n);
      const name = mallowName(state, event.it);
      return pick([`Tag! ${name} is it. Swim away!`, `Tag! ${name} is it!`, `Tag! Quick, ${name} is it!`], n);
    }
    case 'caught': {
      const it = mallowName(state, event.it);
      const by = mallowName(state, event.by);
      if (event.it === 'player') return pick(['Gotcha! You are it', `${by} tagged you! You are it`, `Caught by ${by}! You are it`], n);
      if (event.by === 'player') return pick([`You tagged ${it}!`, `Gotcha, ${it}!`, `Got you, ${it}! ${it} is it`], n);
      return pick([`${by} tagged ${it}!`, `${it} is it now!`], n);
    }
    case 'tagEnd': {
      const catches = event.catches === 1 ? '1 catch' : `${event.catches} catches`;
      if (event.catches === 0) return pick(['What a game!', 'That was fun!'], n);
      return pick([`What a game! ${catches}`, `Hooray! ${catches}`, `That was fun! ${catches}`], n);
    }
    case 'seekStart':
      return pick([`Close your eyes and count! ${event.hiders} are hiding`, 'Hide and seek! Count to ten', 'Everyone hide! You count'], n);
    case 'seekGo':
      return pick(['Ready or not, here I come!', 'Find them!', 'Go and find them!'], n);
    case 'found': {
      const name = mallowName(state, event.who);
      if (event.left === 0) return pick([`You found ${name}!`, `There is ${name}!`], n);
      return pick([`You found ${name}! ${event.left} left`, `There is ${name}! ${event.left} left`, `Peekaboo, ${name}! ${event.left} left`], n);
    }
    case 'seekEnd':
      return pick(['Everyone found! Sweets for all!', 'You found them all! Hooray!', 'All found! What a seeker!'], n);
    case 'shower':
      return pick(['Sweets rain down! Grab them!', 'A shower of sweets!', 'Sweets everywhere!'], n);
    default:
      return null;
  }
}

/** The game's status at the top, and a big word in the middle while counting, or null for both when no game is on. */
export function dreamStatus(state: DreamState): { top: string | null; big: string | null } {
  const g = state.game;
  if (g.kind === 'tag') {
    const left = Math.max(0, Math.ceil(g.ends - state.time));
    const who = g.it === 'player' ? 'You are it!' : `Tag! ${mallowName(state, g.it)} is it`;
    return { top: `${who} ${left} s left`, big: null };
  }
  if (g.kind === 'seek') {
    if (g.phase === 'counting') return { top: 'Hide and seek', big: `Counting... ${Math.max(1, Math.ceil(g.until - state.time))}` };
    return { top: `Find them! ${g.found.length} of ${g.hiders.length} found`, big: null };
  }
  return { top: null, big: null };
}

const INK = '#6a3d7a';
const FONT = "font-family:ui-rounded,'Nunito','Quicksand',system-ui,sans-serif;font-weight:800";
const PILL = `background:rgba(255,246,236,.94);border:3px solid #ffc4de;border-radius:999px;box-shadow:0 4px 0 rgba(200,140,190,.35);color:${INK};${FONT}`;
const CANDY =
  '<svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true" style="flex:none">' +
  '<path d="M10 16 2 9.5 3.5 22.5Z" fill="#ffb3d6"/><path d="M22 16 30 9.5 28.5 22.5Z" fill="#ffb3d6"/>' +
  '<circle cx="16" cy="16" r="8" fill="#ff6fa8"/><path d="M11 11.5q5 3 10 9" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round"/></svg>';

const el = (tag: string, css: string, id?: string): HTMLElement => {
  const e = document.createElement(tag);
  e.style.cssText = css;
  if (id) e.id = id;
  return e;
};

/** Set a text only when it changed, so a frame does not touch the page for nothing. */
const text = (e: HTMLElement, value: string): void => {
  if (e.textContent !== value) e.textContent = value;
};

interface Open {
  root: HTMLElement;
  view: DreamView;
  rig: CameraRig;
  touch: TouchControls | null;
  hud: {
    count: HTMLElement;
    status: HTMLElement;
    big: HTMLElement;
    line: HTMLElement;
    prompt: HTMLElement;
    promptText: HTMLElement;
  };
  state: DreamState;
  diveBefore: boolean;
  /** Lines waiting, the one shown, and how long it has left. */
  lines: string[];
  lineLeft: number;
  said: number;
  /** Play was tapped on the screen's own button, for the next frame. */
  playTapped: boolean;
  waking: boolean;
}

export function createDreamScreen(parent: HTMLElement, opts: DreamScreenOptions): DreamScreen {
  let open: Open | null = null;

  const wake = (): void => {
    const o = open;
    if (!o || o.waking) return;
    o.waking = true;
    // The screen fades out over the dark while the sleep prompt waits in it, then the prompt fades the game in.
    o.root.style.transition = `opacity ${DARK_MS}ms`;
    o.root.style.opacity = '0';
    o.root.style.pointerEvents = 'none';
    opts.onWake();
    setTimeout(() => {
      o.view.dispose();
      o.root.remove();
      if (open === o) open = null;
    }, DARK_MS);
  };

  const build = (seed: number): Open => {
    const state = newDream(seed);
    const root = el(
      'div',
      `position:fixed;inset:0;z-index:21;overflow:hidden;background:#05060d;opacity:0;transition:opacity ${FADE_MS}ms;` +
        'user-select:none;-webkit-user-select:none;touch-action:none',
      'dream',
    );
    parent.appendChild(root);
    try {
      const view = createDreamView(root, state.land);
      const rig = createCameraRig(view.canvas);

      const countBox = el('div', `${PILL};position:absolute;left:max(16px,env(safe-area-inset-left));top:16px;z-index:2;display:flex;align-items:center;gap:8px;padding:6px 18px 6px 10px;font-size:26px;pointer-events:none`, 'dream-count');
      const count = el('span', 'display:inline-block;min-width:1.2em');
      count.textContent = '0';
      countBox.innerHTML = CANDY;
      countBox.append(count);
      const status = el('div', `${PILL};position:absolute;left:50%;top:16px;transform:translateX(-50%);z-index:2;padding:8px 20px;font-size:20px;white-space:nowrap;display:none;pointer-events:none`, 'dream-status');
      const big = el('div', `position:absolute;left:0;right:0;top:38%;z-index:2;text-align:center;font-size:clamp(40px,9vw,84px);color:#fff6ec;text-shadow:0 4px 0 #e79ab8,0 0 24px rgba(201,182,255,.9);display:none;pointer-events:none;${FONT}`, 'dream-big');
      const line = el('div', `${PILL};position:absolute;left:50%;top:76px;transform:translateX(-50%);z-index:2;max-width:min(86vw,520px);padding:8px 20px;font-size:19px;text-align:center;background:rgba(253,230,238,.95);opacity:0;transition:opacity .3s;pointer-events:none`, 'dream-line');
      line.setAttribute('role', 'status');
      // On touch the prompt sits low between the stick and the buttons.
      const prompt = el('div', `${PILL};position:absolute;left:50%;bottom:${opts.touch ? 24 : 56}px;transform:translateX(-50%);z-index:2;display:none;align-items:center;gap:14px;padding:8px 10px 8px 20px;font-size:20px;pointer-events:none;${opts.touch ? 'max-width:min(600px,calc(100vw - 440px))' : 'white-space:nowrap'}`, 'dream-prompt');
      const promptText = el('span', '');
      prompt.append(promptText);
      const wakeButton = el('button', `${PILL};position:absolute;right:max(16px,env(safe-area-inset-right));top:16px;z-index:3;min-height:48px;padding:8px 20px;font-size:18px;background:#e6dafc;border-color:#c9b6ff;cursor:pointer`) as HTMLButtonElement;
      wakeButton.type = 'button';
      wakeButton.textContent = 'Wake up';
      wakeButton.dataset.action = 'dream-wake';
      wakeButton.addEventListener('click', wake);
      root.append(countBox, status, big, line, prompt, wakeButton);

      let touch: TouchControls | null = null;
      if (opts.touch) {
        touch = createTouchControls(root, true, { idPrefix: 'dream-touch', labels: { dive: 'Hop', slap: 'Splash', do: 'Play', take: null } });
        // A big round Play button next to the prompt, which is easier to find than the one among the others.
        const play = el('button', `position:relative;width:64px;height:64px;border-radius:50%;border:3px solid #fff;background:#ff8fc1;color:#fff;font-size:18px;cursor:pointer;pointer-events:auto;touch-action:none;box-shadow:0 4px 0 #e06aa3;${FONT}`) as HTMLButtonElement;
        play.type = 'button';
        play.textContent = 'Play';
        play.dataset.action = 'dream-play';
        prompt.append(play);
        play.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          if (open) open.playTapped = true;
        });
      } else {
        const keys = el('div', `position:absolute;left:50%;bottom:16px;transform:translateX(-50%);z-index:2;padding:6px 16px;border-radius:999px;background:rgba(106,61,122,.55);color:#fff6ec;font-size:14px;white-space:nowrap;pointer-events:none;${FONT}`, 'dream-keys');
        keys.textContent = 'WASD move, Space hop, T splash, E play';
        root.append(keys);
      }
      // Read the layout once so the fade starts from 0.
      void root.offsetWidth;
      root.style.opacity = '1';
      return {
        root,
        view,
        rig,
        touch,
        hud: { count, status, big, line, prompt, promptText },
        state,
        diveBefore: false,
        lines: [],
        lineLeft: 0,
        said: 0,
        playTapped: false,
        waking: false,
      };
    } catch (e) {
      root.remove();
      throw e;
    }
  };

  const showHud = (o: Open, events: readonly DreamEvent[], dt: number, countBefore: number): void => {
    const { hud, state } = o;
    if (state.count !== countBefore) {
      text(hud.count, String(state.count));
      // A little pop for each sweet.
      if (state.count > countBefore) hud.count.animate?.([{ transform: 'scale(1)' }, { transform: 'scale(1.45)' }, { transform: 'scale(1)' }], { duration: 380, easing: 'ease-out' });
    }
    const s = dreamStatus(state);
    hud.status.style.display = s.top ? 'block' : 'none';
    if (s.top) text(hud.status, s.top);
    hud.big.style.display = s.big ? 'block' : 'none';
    if (s.big) text(hud.big, s.big);
    for (const e of events) {
      const said = dreamLine(e, state, o.said);
      if (said === null) continue;
      o.said++;
      o.lines.push(said);
      if (o.lines.length > LINE_QUEUE) o.lines.shift();
    }
    o.lineLeft -= dt;
    if (o.lineLeft <= 0) {
      const next = o.lines.shift();
      if (next === undefined) hud.line.style.opacity = '0';
      else {
        text(hud.line, next);
        hud.line.style.opacity = '1';
        o.lineLeft = o.lines.length > 0 ? LINE_SECONDS_BUSY : LINE_SECONDS;
      }
    } else if (o.lines.length > 0) o.lineLeft = Math.min(o.lineLeft, LINE_SECONDS_BUSY);
    const ask = playPrompt(state);
    hud.prompt.style.display = ask ? 'flex' : 'none';
    if (ask) text(hud.promptText, opts.touch ? ask : `${ask} (E)`);
  };

  return {
    start(seed) {
      if (open) return;
      try {
        open = build(seed);
      } catch (e) {
        // A dream that cannot open must not leave the player in the dark.
        console.error('dream: could not start', e);
        open = null;
        opts.onWake();
      }
    },
    frame(dt, actions) {
      const o = open;
      if (!o) return;
      if (o.waking) {
        o.view.draw(o.state, o.rig.view, []);
        return;
      }
      // The dream's own touch buttons add to the game's input, as the game's touch buttons add to the keys.
      const merged = mergeActions(actions, o.touch?.read() ?? noActions());
      if (o.playTapped) merged.act = true;
      o.playTapped = false;
      const input = dreamInput(merged, o.rig.view.yaw, o.diveBefore);
      o.diveBefore = !!merged.dive;
      const countBefore = o.state.count;
      const stepped = stepDream(o.state, input, dt);
      o.state = stepped.state;
      o.rig.update(dt, o.state.beaver.heading, merged.move.x !== 0 || merged.move.z !== 0);
      o.view.draw(o.state, o.rig.view, stepped.events);
      showHud(o, stepped.events, dt, countBefore);
    },
    active: () => open !== null,
    state: () => open?.state ?? null,
  };
}
