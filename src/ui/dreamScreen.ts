// The dream screen (docs/design/29_dream_candy_land.md): candy land over the whole game, with the sweet count, the game's status,
// short lines for what happens, the prompt for a game, touch buttons of its own, and Wake up. It owns the dream's state, steps
// it with the player's actions, and draws it with the dream's own scene. The waking game stands still while it is open (main.ts).

import { t, tList } from '../i18n';
import { mergeActions, noActions, relativeToView, type Actions } from '../actions/actions';
import { createCameraRig, type CameraRig } from '../render/cameraRig';
import { createDreamView, type DreamView } from '../render/dreamView';
import { hideOrSeek, newDream, type DreamBuild, playPrompt, stepDream, type DreamEvent, type DreamInput, type DreamState } from '../sim/dream';
import { DARK_MS, FADE_MS } from './sleepPrompt';
import { createTouchControls, type TouchControls } from './touchControls';

export interface DreamScreen {
  /** Open a new dream from a seed. Does nothing while a dream is open. */
  start(seed: number, kept?: readonly DreamBuild[]): void;
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
  /** Called when the player chose, at waking, to keep the dream's candy dam and lodge for later dreams (Q81). */
  onKeep?(builds: readonly DreamBuild[]): void;
  /** Show the dream's own touch buttons, else a line with the keys. */
  touch: boolean;
  /** Called each frame with what happened in the dream, for its sounds. */
  onEvents?(events: readonly DreamEvent[]): void;
}

/** Seconds a line stays, and less when more wait behind it. At most this many wait. */
const LINE_SECONDS = 2.6;
const LINE_SECONDS_BUSY = 1.4;
const LINE_QUEUE = 3;

/** The dream's input from the player's actions: the move turned to the view, a hop only on the frame Dive goes down, and a pick of hide or seek. */
export function dreamInput(actions: Actions, yaw: number, diveBefore: boolean, pick?: DreamInput['pick']): DreamInput {
  return { move: relativeToView(actions.move, yaw), hop: !!actions.dive && !diveBefore, slap: !!actions.slap, play: !!actions.act, pick };
}

/** The keys for the two picks, by `KeyboardEvent.code`. */
export const PICK_KEYS: Readonly<Record<string, 'hide' | 'seek'>> = { Digit1: 'hide', Numpad1: 'hide', Digit2: 'seek', Numpad2: 'seek' };

/** A marshmallow beaver's name from an event, which may carry its id or its name. 'player' stays 'player'. */
export function mallowName(state: DreamState, who: string): string {
  return state.mallows.find((m) => m.id === who)?.name ?? who;
}

const pick = (lines: readonly string[], n: number): string => lines[Math.abs(Math.floor(n)) % lines.length]!;

/** The line for an event, picked from a few by the counter `n`, or null for events that need none (a sweet, a splash, a giggle). */
export function dreamLine(event: DreamEvent, state: DreamState, n: number): string | null {
  const one = (key: string, params?: Record<string, string | number>): string => pick(tList(key, params), n);
  switch (event.what) {
    case 'sweet':
      return event.kind === 'star' ? one('dream.star') : null;
    case 'chop':
      return one('dream.chopped');
    case 'build':
      return one(`dream.${event.kind}${event.done ? 'Done' : 'Grows'}`);
    case 'statue':
      return one('dream.statue');
    case 'rush':
      return one('dream.rush');
    case 'greet':
      return one('dream.greet', { name: mallowName(state, event.who) });
    case 'tagStart':
      return event.it === 'player' ? one('dream.tagYou') : one('dream.tagOther', { name: mallowName(state, event.it) });
    case 'caught': {
      const it = mallowName(state, event.it);
      const by = mallowName(state, event.by);
      if (event.it === 'player') return one('dream.caughtYou', { by });
      if (event.by === 'player') return one('dream.caughtBy', { it });
      return one('dream.caughtOther', { by, it });
    }
    case 'tagEnd': {
      if (event.catches === 0) return one('dream.tagEndNone');
      return one('dream.tagEnd', { catches: event.catches === 1 ? t('dream.catchOne') : t('dream.catches', { n: event.catches }) });
    }
    case 'seekStart':
      return one('dream.seekStart', { hiders: event.hiders });
    case 'seekGo':
      return one('dream.seekGo');
    case 'found': {
      const name = mallowName(state, event.who);
      return event.left === 0 ? one('dream.foundLast', { name }) : one('dream.found', { name, left: event.left });
    }
    case 'seekEnd':
      return one('dream.seekEnd');
    case 'hideStart':
      return one('dream.hideStart', { who: event.seekers === 1 ? t('dream.friendCounts') : t('dream.friendsCount', { n: event.seekers }) });
    case 'hideGo':
      return one('dream.hideGo');
    case 'spotted': {
      const name = mallowName(state, event.who);
      return event.left === 0 ? one('dream.spottedLast', { name }) : one('dream.spotted', { name, left: event.left });
    }
    case 'hideEnd':
      if (event.found === event.seekers) return one('dream.hideEndAll');
      if (event.found === 0) return one('dream.hideEndNone');
      return one('dream.hideEnd', { found: event.found, seekers: event.seekers });
    case 'shower':
      return one('dream.shower');
    default:
      return null;
  }
}

/** The game's status at the top, and a big word in the middle while counting, or null for both when no game is on. */
export function dreamStatus(state: DreamState): { top: string | null; big: string | null } {
  const g = state.game;
  if (g.kind === 'tag') {
    const n = Math.max(0, Math.ceil(g.ends - state.time));
    const who = g.it === 'player' ? t('dream.youAreIt') : t('dream.tagIt', { name: mallowName(state, g.it) });
    return { top: t('dream.secondsLeft', { who, n }), big: null };
  }
  if (g.kind === 'seek') {
    if (g.phase === 'counting') return { top: t('dream.statusSeek'), big: t('dream.counting', { n: Math.max(1, Math.ceil(g.until - state.time)) }) };
    return { top: t('dream.findThem', { found: g.found.length, hiders: g.hiders.length }), big: null };
  }
  if (g.kind === 'hide') {
    if (g.phase === 'counting') return { top: t('dream.runHide'), big: t('dream.hideCount', { n: Math.max(1, Math.ceil(g.until - state.time)) }) };
    const left = t('dream.sLeft', { n: Math.max(0, Math.ceil(g.until - state.time)) });
    return { top: g.found.length === 0 ? t('dream.shh', { left }) : t('dream.foundYou', { found: g.found.length, seekers: g.seekers.length, left }), big: null };
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
    choice: HTMLElement;
    choiceText: HTMLElement;
    keep: HTMLElement;
  };
  state: DreamState;
  diveBefore: boolean;
  /** Lines waiting, the one shown, and how long it has left. */
  lines: string[];
  lineLeft: number;
  said: number;
  /** Play was tapped on the screen's own button, for the next frame. */
  playTapped: boolean;
  /** Hide or seek was tapped or keyed, for the next frame. */
  picked: DreamInput['pick'];
  onKey: (e: KeyboardEvent) => void;
  waking: boolean;
  /** The dream's dams and lodges when it began, to see whether this dream built or added anything, and whether Keep is being asked. */
  began: string;
  keeping: boolean;
  /** True once the first frame is drawn and the screen has started to fade in. */
  warm: boolean;
  /** True while the view compiles its shaders in the background, before the first draw. */
  compiling: boolean;
}

export function createDreamScreen(parent: HTMLElement, opts: DreamScreenOptions): DreamScreen {
  let open: Open | null = null;

  const buildsOf = (s: DreamState): string => JSON.stringify(s.builds ?? []);

  /** Wake up. When this dream built something, ask first whether to keep it for the next dreams. */
  const wakeClick = (): void => {
    const o = open;
    if (!o || o.waking || o.keeping) return;
    if (buildsOf(o.state) === o.began) return wake(false);
    o.keeping = true;
    o.hud.keep.style.display = 'flex';
  };

  const wake = (keep: boolean): void => {
    const o = open;
    if (!o || o.waking) return;
    o.waking = true;
    o.hud.keep.style.display = 'none';
    if (keep) opts.onKeep?.(o.state.builds ?? []);
    // The screen fades out over the dark while the sleep prompt waits in it, then the prompt fades the game in.
    o.root.style.transition = `opacity ${DARK_MS}ms`;
    o.root.style.opacity = '0';
    o.root.style.pointerEvents = 'none';
    opts.onWake();
    window.removeEventListener('keydown', o.onKey);
    setTimeout(() => {
      o.view.dispose();
      o.root.remove();
      if (open === o) open = null;
    }, DARK_MS);
  };

  const build = (seed: number, kept: readonly DreamBuild[]): Open => {
    const state = newDream(seed, kept);
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
      wakeButton.textContent = t('dream.wake');
      wakeButton.dataset.action = 'dream-wake';
      wakeButton.addEventListener('click', wakeClick);
      // Play on land asks: hide or seek? Two big buttons, and the keys 1 and 2.
      const choice = el('div', `${PILL};position:absolute;left:50%;bottom:${opts.touch ? 24 : 56}px;transform:translateX(-50%);z-index:2;display:none;flex-direction:column;align-items:center;gap:10px;padding:12px 16px;border-radius:28px;font-size:20px;pointer-events:none;${opts.touch ? 'max-width:min(600px,calc(100vw - 440px))' : 'white-space:nowrap'}`, 'dream-choice');
      const choiceText = el('span', 'text-align:center');
      const choiceRow = el('div', 'display:flex;gap:14px;justify-content:center;flex-wrap:wrap');
      for (const [want, label, key, colour, edge] of [
        ['hide', t('dream.hide'), '1', '#8fd6bd', '#5fb79a'],
        ['seek', t('dream.seek'), '2', '#ff8fc1', '#e06aa3'],
      ] as const) {
        const b = el('button', `min-width:120px;min-height:64px;padding:8px 22px;border-radius:999px;border:3px solid #fff;background:${colour};color:#fff;font-size:22px;cursor:pointer;pointer-events:auto;touch-action:none;box-shadow:0 4px 0 ${edge};${FONT}`) as HTMLButtonElement;
        b.type = 'button';
        b.textContent = opts.touch ? label : `${label} (${key})`;
        b.dataset.action = `dream-${want}`;
        b.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          if (open) open.picked = want;
        });
        choiceRow.append(b);
      }
      choice.append(choiceText, choiceRow);
      // Waking after building asks: keep the candy dam and lodge for the next dreams?
      const keep = el('div', `${PILL};position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:4;display:none;flex-direction:column;align-items:center;gap:12px;padding:16px 20px;border-radius:28px;font-size:20px;text-align:center;max-width:min(86vw,460px)`, 'dream-keep');
      const keepText = el('span', '');
      keepText.textContent = t('dream.keepAsk');
      const keepRow = el('div', 'display:flex;gap:14px;justify-content:center;flex-wrap:wrap');
      for (const [yes, label, colour, edge] of [
        [true, t('dream.keep'), '#8fd6bd', '#5fb79a'],
        [false, t('dream.letGo'), '#ff8fc1', '#e06aa3'],
      ] as const) {
        const b = el('button', `min-width:120px;min-height:64px;padding:8px 22px;border-radius:999px;border:3px solid #fff;background:${colour};color:#fff;font-size:22px;cursor:pointer;touch-action:none;box-shadow:0 4px 0 ${edge};${FONT}`) as HTMLButtonElement;
        b.type = 'button';
        b.textContent = label;
        b.dataset.action = yes ? 'dream-keep' : 'dream-letgo';
        b.addEventListener('click', () => wake(yes));
        keepRow.append(b);
      }
      keep.append(keepText, keepRow);
      root.append(countBox, status, big, line, prompt, choice, keep, wakeButton);

      let touch: TouchControls | null = null;
      if (opts.touch) {
        touch = createTouchControls(root, true, { idPrefix: 'dream-touch', labels: { dive: t('dream.hop'), slap: t('dream.splash'), do: t('dream.play'), take: null } });
        // A big round Play button next to the prompt, which is easier to find than the one among the others.
        const play = el('button', `position:relative;width:64px;height:64px;border-radius:50%;border:3px solid #fff;background:#ff8fc1;color:#fff;font-size:18px;cursor:pointer;pointer-events:auto;touch-action:none;box-shadow:0 4px 0 #e06aa3;${FONT}`) as HTMLButtonElement;
        play.type = 'button';
        play.textContent = t('dream.play');
        play.dataset.action = 'dream-play';
        prompt.append(play);
        play.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          if (open) open.playTapped = true;
        });
      } else {
        const keys = el('div', `position:absolute;left:50%;bottom:16px;transform:translateX(-50%);z-index:2;padding:6px 16px;border-radius:999px;background:rgba(106,61,122,.55);color:#fff6ec;font-size:14px;white-space:nowrap;pointer-events:none;${FONT}`, 'dream-keys');
        keys.textContent = t('dream.keys');
        root.append(keys);
      }
      const onKey = (e: KeyboardEvent): void => {
        const want = PICK_KEYS[e.code];
        if (want && open && !open.waking && hideOrSeek(open.state) !== null) open.picked = want;
      };
      window.addEventListener('keydown', onKey);
      // The fade starts after the first draw (`frame`), which compiles the shaders and makes the models in a stall of its own.
      const o: Open = {
        root,
        view,
        rig,
        touch,
        hud: { count, status, big, line, prompt, promptText, choice, choiceText, keep },
        state,
        diveBefore: false,
        lines: [],
        lineLeft: 0,
        said: 0,
        playTapped: false,
        picked: undefined,
        onKey,
        waking: false,
        began: buildsOf(state),
        keeping: false,
        warm: false,
        compiling: false,
      };
      if (view.warm) {
        o.compiling = true;
        const done = (): void => {
          o.compiling = false;
        };
        view.warm().then(done, done);
      }
      return o;
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
    if (ask) text(hud.promptText, opts.touch ? ask : t('dream.promptKey', { ask }));
    const asked = hideOrSeek(state);
    hud.choice.style.display = asked ? 'flex' : 'none';
    if (asked) text(hud.choiceText, t('dream.ask', { name: asked }));
  };

  return {
    start(seed, kept = []) {
      if (open) return;
      try {
        open = build(seed, kept);
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
      if (!o.warm && o.compiling) return;
      if (!o.warm) {
        // Draw once while the screen is still clear (the sleep prompt's dark covers the game), so the stall of the first draw
        // (#638) is not in the fade and not in the same frame as the build. The dream's time starts after it.
        o.view.draw(o.state, o.rig.view, []);
        o.warm = true;
        void o.root.offsetWidth; // read the layout once so the fade starts from 0
        o.root.style.opacity = '1';
        return;
      }
      if (o.waking || o.keeping) {
        o.view.draw(o.state, o.rig.view, []);
        return;
      }
      // The dream's own touch buttons add to the game's input, as the game's touch buttons add to the keys.
      const merged = mergeActions(actions, o.touch?.read() ?? noActions());
      if (o.playTapped) merged.act = true;
      o.playTapped = false;
      const input = dreamInput(merged, o.rig.view.yaw, o.diveBefore, o.picked);
      o.picked = undefined;
      o.diveBefore = !!merged.dive;
      const countBefore = o.state.count;
      const stepped = stepDream(o.state, input, dt);
      o.state = stepped.state;
      o.rig.update(dt, o.state.beaver.heading, merged.move.x !== 0 || merged.move.z !== 0);
      o.view.draw(o.state, o.rig.view, stepped.events);
      showHud(o, stepped.events, dt, countBefore);
      if (stepped.events.length > 0) opts.onEvents?.(stepped.events);
    },
    active: () => open !== null,
    state: () => open?.state ?? null,
  };
}
