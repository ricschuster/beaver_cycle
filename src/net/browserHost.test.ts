import { describe, expect, it } from 'vitest';
import { browserHostPlugin } from './browserHost';

class FakeSocket {
  readyState = 1;
  sent: string[] = [];
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  url = '';
  send(s: string): void {
    this.sent.push(s);
  }
  close(): void {
    this.readyState = 3;
  }
}

function setup() {
  const ws = new FakeSocket();
  const plugin = browserHostPlugin((u) => {
    ws.url = u;
    return ws as unknown as WebSocket;
  });
  return { ws, plugin };
}

describe('browserHostPlugin', () => {
  it('starts with the ip the bridge gives and passes guest events on', async () => {
    const { ws, plugin } = setup();
    const seen: string[] = [];
    await plugin.addListener('open', (e) => seen.push(`open ${e.id}`));
    await plugin.addListener('message', (e) => seen.push(`${e.id}: ${e.text}`));
    await plugin.addListener('close', (e) => seen.push(`close ${e.id}`));
    const started = plugin.start({ port: 8765 });
    ws.onmessage?.({ data: JSON.stringify({ t: 'ip', ip: '192.168.1.5', port: 8765 }) });
    expect(await started).toEqual({ ip: '192.168.1.5', port: 8765 });
    expect(ws.url).toBe('ws://localhost:8766');
    ws.onmessage?.({ data: JSON.stringify({ t: 'open', id: 'g1' }) });
    ws.onmessage?.({ data: JSON.stringify({ t: 'message', id: 'g1', text: '{"t":"hello"}' }) });
    ws.onmessage?.({ data: JSON.stringify({ t: 'close', id: 'g1' }) });
    ws.onmessage?.({ data: 'not json' });
    expect(seen).toEqual(['open g1', 'g1: {"t":"hello"}', 'close g1']);
  });

  it('sends to one guest or to all', async () => {
    const { ws, plugin } = setup();
    const started = plugin.start({ port: 8765 });
    ws.onmessage?.({ data: JSON.stringify({ t: 'ip', ip: 'x', port: 8765 }) });
    await started;
    await plugin.send({ to: 'g2', text: 'a' });
    await plugin.send({ text: 'b' });
    expect(ws.sent.map((s) => JSON.parse(s))).toEqual([{ t: 'send', to: 'g2', text: 'a' }, { t: 'send', text: 'b' }]);
  });

  it('rejects when the bridge is not running', async () => {
    const { ws, plugin } = setup();
    const started = plugin.start({ port: 8765 });
    ws.onerror?.();
    await expect(started).rejects.toThrow(/host-bridge/);
  });
});
