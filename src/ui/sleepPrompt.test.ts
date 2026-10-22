import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DARK_MS, FADE_MS, createSleepPrompt, type SleepGoal } from './sleepPrompt';

interface FakeEl {
  id: string;
  textContent: string;
  hidden: boolean;
  offsetWidth: number;
  dataset: Record<string, string>;
  style: Record<string, string>;
  onclick: (() => void) | null;
  append(...els: FakeEl[]): void;
}

/** The prompt only needs elements with a style, a dataset and a click, so plain objects stand in for the DOM. */
function fakeDom(): { byAction: (a: string) => FakeEl; dark: () => FakeEl } {
  const made: FakeEl[] = [];
  vi.stubGlobal('document', {
    createElement: (): FakeEl => {
      const e: FakeEl = { id: '', textContent: '', hidden: false, offsetWidth: 0, dataset: {}, style: {}, onclick: null, append: () => {} };
      made.push(e);
      return e;
    },
  });
  return {
    byAction: (a) => made.find((e) => e.dataset.action === a)!,
    dark: () => made.find((e) => e.id === 'sleep-dark')!,
  };
}

describe('the sleep prompt and the dream', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const make = (hold?: (g: SleepGoal) => boolean, giveUp?: () => void) => {
    const dom = fakeDom();
    const woke: (SleepGoal | null)[] = [];
    const themes: string[] = [];
    const prompt = createSleepPrompt({ append: () => {} } as unknown as HTMLElement, {
      onWake: (g) => woke.push(g),
      onDream: (theme) => themes.push(theme),
      ...(hold ? { onLie: hold } : {}),
      ...(giveUp ? { onGiveUp: giveUp } : {}),
    });
    prompt.set({ night: true, rest: false, grow: null });
    return { dom, woke, dreams: () => themes.length, themes, prompt };
  };

  it('fades to black and opens the dream, and wakes at dawn only when the dream ends', () => {
    const { dom, woke, dreams, themes, prompt } = make();
    dom.byAction('sleep-dream').onclick!();
    // The Dream button asks which dream first.
    expect(dom.dark().style.opacity).not.toBe('1');
    expect(dom.byAction('sleep-dream').hidden).toBe(true);
    expect(dom.byAction('sleep-dream-candy').hidden).toBe(false);
    expect(dom.byAction('sleep-dream-veggie').hidden).toBe(false);
    dom.byAction('sleep-dream-candy').onclick!();
    expect(dom.dark().style.opacity).toBe('1');
    vi.advanceTimersByTime(FADE_MS);
    expect(dreams()).toBe(1);
    expect(themes).toEqual(['candy']);
    vi.advanceTimersByTime(60_000);
    expect(woke).toEqual([]);
    prompt.wakeFromDream();
    expect(woke).toEqual(['night']);
    vi.advanceTimersByTime(DARK_MS);
    expect(dom.dark().style.opacity).toBe('0');
    // A second wake from the same dream does nothing.
    prompt.wakeFromDream();
    vi.advanceTimersByTime(DARK_MS + FADE_MS);
    expect(woke).toEqual(['night']);
  });

  it('opens the veggie garden when it is chosen', () => {
    const { dom, themes } = make();
    dom.byAction('sleep-dream').onclick!();
    dom.byAction('sleep-dream-veggie').onclick!();
    vi.advanceTimersByTime(FADE_MS);
    expect(themes).toEqual(['veggie']);
  });

  it('wakes a dream that started without the Dream button from a dark put up at once', () => {
    const { dom, woke, dreams, prompt } = make();
    prompt.wakeFromDream();
    expect(dreams()).toBe(0);
    expect(woke).toEqual(['night']);
    expect(dom.dark().style.opacity).toBe('1');
    vi.advanceTimersByTime(DARK_MS);
    expect(dom.dark().style.opacity).toBe('0');
  });

  it('does not wake twice while a plain sleep is under way', () => {
    const { dom, woke, prompt } = make();
    dom.byAction('sleep-skip').onclick!();
    prompt.wakeFromDream();
    expect(woke).toEqual([]);
    vi.advanceTimersByTime(FADE_MS);
    expect(woke).toEqual(['night']);
  });

  it('stays dark while the friends are asked, and wakes with the skip on a yes (#661)', () => {
    const lies: SleepGoal[] = [];
    const { dom, woke, prompt } = make((g) => {
      lies.push(g);
      return true;
    });
    dom.byAction('sleep-skip').onclick!();
    vi.advanceTimersByTime(FADE_MS);
    expect(lies).toEqual(['night']);
    expect(dom.byAction('sleep-waiting').style.display).toBe('flex');
    vi.advanceTimersByTime(60_000);
    expect(woke).toEqual([]);
    prompt.release(true);
    expect(woke).toEqual(['night']);
    expect(dom.byAction('sleep-waiting').style.display).toBe('none');
  });

  it('wakes with no skip on a no, and does nothing for a release it did not wait for', () => {
    const { dom, woke, prompt } = make(() => true);
    prompt.release(true);
    expect(woke).toEqual([]);
    dom.byAction('sleep-season').onclick!();
    vi.advanceTimersByTime(FADE_MS);
    prompt.release(false);
    expect(woke).toEqual([null]);
  });

  it('lets the sleeper give up waiting', () => {
    let gaveUp = 0;
    const { dom, woke } = make(() => true, () => gaveUp++);
    dom.byAction('sleep-skip').onclick!();
    vi.advanceTimersByTime(FADE_MS);
    dom.byAction('sleep-giveup').onclick!();
    expect(gaveUp).toBe(1);
    expect(woke).toEqual([null]);
  });

  it('hides the dream button for a tablet with no dream of its own', () => {
    const { dom, prompt } = make();
    prompt.set({ night: true, rest: false, grow: null, dream: false });
    expect(dom.byAction('sleep-dream').hidden).toBe(true);
    expect(dom.byAction('sleep-skip').hidden).toBe(false);
  });
});
