import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { joinHost, RECONNECT_MS } from './session';

class FakeSocket {
  static all: FakeSocket[] = [];
  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  constructor(public url: string) {
    FakeSocket.all.push(this);
  }
  send(s: string) {
    this.sent.push(s);
  }
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
}

const sock = (i: number): FakeSocket => FakeSocket.all[i]!;

describe('joinHost', () => {
  beforeEach(() => {
    FakeSocket.all = [];
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeSocket);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const hello = { t: 'hello', coat: 0, look: 0 } as never;

  it('reconnects with the same hello after a good link closed', () => {
    const link = joinHost('10.0.0.2', hello);
    sock(0).open();
    sock(0).onmessage!({ data: JSON.stringify({ t: 'welcome', id: 'g1' }) });
    expect(link.id).toBe('g1');
    sock(0).close();
    expect(link.status()).toBe('closed');
    expect(link.id).toBeNull();
    vi.advanceTimersByTime(RECONNECT_MS);
    expect(FakeSocket.all).toHaveLength(2);
    sock(1).open();
    expect(link.status()).toBe('open');
    expect(sock(1).sent[0]).toBe(sock(0).sent[0]);
  });

  it('fails without retrying when the host was never reached', () => {
    const link = joinHost('10.0.0.2', hello);
    sock(0).onerror!();
    sock(0).close();
    vi.advanceTimersByTime(RECONNECT_MS * 3);
    expect(link.status()).toBe('failed');
    expect(FakeSocket.all).toHaveLength(1);
  });

  it('does not reconnect after the guest leaves', () => {
    const link = joinHost('10.0.0.2', hello);
    sock(0).open();
    link.close();
    vi.advanceTimersByTime(RECONNECT_MS * 3);
    expect(FakeSocket.all).toHaveLength(1);
  });
});
