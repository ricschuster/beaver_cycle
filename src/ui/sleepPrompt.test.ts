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

  const make = () => {
    const dom = fakeDom();
    const woke: SleepGoal[] = [];
    const themes: string[] = [];
    const prompt = createSleepPrompt({ append: () => {} } as unknown as HTMLElement, {
      onWake: (g) => woke.push(g),
      onDream: (theme) => themes.push(theme),
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
});
