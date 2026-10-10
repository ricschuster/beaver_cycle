import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TOAST_FADE_MS, TOAST_MS, createToast } from './toast';

/** The toast only needs an element with a text and a style, so a plain object stands in for the DOM. */
function fakeParent(): { root: { textContent: string; style: { opacity: string; cssText: string } }; parent: HTMLElement } {
  const root = { textContent: '', style: { opacity: '0', cssText: '' }, setAttribute: () => {}, id: '' };
  vi.stubGlobal('document', { createElement: () => root });
  return { root, parent: { appendChild: () => {} } as unknown as HTMLElement };
}

describe('toast', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('shows queued messages in turn', () => {
    const { root, parent } = fakeParent();
    const toast = createToast(parent);
    toast.show('a');
    toast.show('b');
    expect(root.textContent).toBe('a');
    vi.advanceTimersByTime(TOAST_MS + TOAST_FADE_MS);
    expect(root.textContent).toBe('b');
  });

  it('shows an urgent message at once and keeps the queue', () => {
    const { root, parent } = fakeParent();
    const toast = createToast(parent);
    toast.show('a');
    toast.show('b');
    toast.show('fox', true);
    expect(root.textContent).toBe('fox');
    // The replaced toast's timer does nothing, and the urgent one stays its full time before the queue goes on.
    vi.advanceTimersByTime(TOAST_MS - 1);
    expect(root.textContent).toBe('fox');
    vi.advanceTimersByTime(1 + TOAST_FADE_MS);
    expect(root.textContent).toBe('b');
    vi.advanceTimersByTime(TOAST_MS + TOAST_FADE_MS);
    expect(root.style.opacity).toBe('0');
  });
});
