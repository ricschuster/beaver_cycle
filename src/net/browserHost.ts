// A laptop browser hosting for tablets on the WLAN (ADR 0014, amended): a page cannot listen on a socket, so `tools/host-bridge`
// listens for it and this talks to the bridge on localhost with the same four calls and events as the app's HostServer plugin.
// Dev tools only (`?hostbridge=1`); the release build never reaches it.

export const BRIDGE_PORT = 8766;

export interface HostPluginLike {
  start(o: { port: number }): Promise<{ ip: string; port: number }>;
  send(o: { text: string; to?: string }): Promise<void>;
  stop(): Promise<void>;
  addListener(name: 'open' | 'close' | 'message' | 'error', fn: (e: { id?: string; text?: string; error?: string }) => void): Promise<unknown>;
}

type Listener = (e: { id?: string; text?: string; error?: string }) => void;

/** Bridge to page: `ip` once, then `open`, `close` and `message` per guest. Page to bridge: `send`. */
export function browserHostPlugin(open: (url: string) => WebSocket = (u) => new WebSocket(u)): HostPluginLike {
  const listeners = new Map<string, Listener[]>();
  let ws: WebSocket | null = null;
  const emit = (name: string, e: Parameters<Listener>[0]): void => {
    for (const fn of listeners.get(name) ?? []) fn(e);
  };
  return {
    async addListener(name, fn) {
      listeners.set(name, [...(listeners.get(name) ?? []), fn]);
    },
    start(o) {
      return new Promise((resolve, reject) => {
        const w = open(`ws://localhost:${BRIDGE_PORT}`);
        ws = w;
        let started = false;
        w.onerror = () => {
          if (!started) reject(new Error('The host bridge is not running (npm run host-bridge).'));
          else emit('error', { error: 'bridge link lost' });
        };
        w.onclose = () => {
          if (started) emit('error', { error: 'bridge closed' });
        };
        w.onmessage = (ev) => {
          let m: { t?: string; ip?: string; port?: number; id?: string; text?: string };
          try {
            m = JSON.parse(String(ev.data));
          } catch {
            return;
          }
          if (m.t === 'ip') {
            started = true;
            resolve({ ip: m.ip ?? '', port: m.port ?? o.port });
          } else if (m.t === 'open' || m.t === 'close' || m.t === 'message') emit(m.t, { id: m.id, text: m.text });
        };
      });
    },
    async send(o) {
      if (ws && ws.readyState === 1) ws.send(JSON.stringify({ t: 'send', to: o.to, text: o.text }));
    },
    async stop() {
      ws?.close();
      ws = null;
    },
  };
}
