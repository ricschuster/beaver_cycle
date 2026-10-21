import { describe, expect, it } from 'vitest';
import { intentOf, readToGuest, readToHost } from './protocol';

describe('messages from a guest', () => {
  it('read an intent and clamp the move to the unit circle', () => {
    const m = readToHost('{"t":"intent","x":30,"z":40,"dive":true,"gnaw":false}');
    expect(m).toMatchObject({ t: 'intent', dive: true, gnaw: false });
    if (m?.t !== 'intent') throw new Error('not an intent');
    expect(Math.hypot(m.x, m.z)).toBeCloseTo(1, 5);
    expect(intentOf(m).do).toBeNull();
  });

  it('turn bad numbers into zero and a gnaw into the Do word', () => {
    const m = readToHost('{"t":"intent","x":"far","z":null,"gnaw":true}');
    expect(m).toEqual({ t: 'intent', x: 0, z: 0, dive: false, gnaw: true });
    expect(intentOf(m as never).do).toBe('gnaw');
  });

  it('clean a hello: look inside its ranges, coat inside the browns', () => {
    const m = readToHost('{"t":"hello","coat":{"coat":99,"shade":7},"look":{"hat":50,"name":"Pip"}}');
    expect(m).toMatchObject({ t: 'hello', coat: { coat: 4, shade: 1 }, look: { hat: 0, name: 'Pip' } });
  });

  it('clean a look message the same way', () => {
    const m = readToHost('{"t":"look","coat":{"coat":99,"shade":7},"look":{"hat":50,"name":"Kit"}}');
    expect(m).toMatchObject({ t: 'look', coat: { coat: 4, shade: 1 }, look: { hat: 0, name: 'Kit' } });
  });

  it('refuse text that is not a message', () => {
    expect(readToHost('nope')).toBeNull();
    expect(readToHost('{"t":"explode"}')).toBeNull();
    expect(readToHost('null')).toBeNull();
  });
});

describe('a press of Dive', () => {
  it('comes through as a tap only when the guest says so', () => {
    const tap = readToHost('{"t":"intent","x":0,"z":0,"dive":false,"diveTap":true,"gnaw":false}');
    expect(intentOf(tap as never).diveTap).toBe(true);
    expect(intentOf(readToHost('{"t":"intent","x":0,"z":0,"dive":true,"gnaw":false}') as never).diveTap).toBe(false);
  });
});

describe('messages from the host', () => {
  it('read the three kinds and refuse the rest', () => {
    expect(readToGuest('{"t":"welcome","id":"g1"}')).toEqual({ t: 'welcome', id: 'g1' });
    expect(readToGuest('{"t":"x"}')).toBeNull();
    expect(readToGuest('<')).toBeNull();
  });

  it('reads Do and Take from a guest, and drops words it does not know', () => {
    const m = readToHost('{"t":"intent","x":0,"z":0,"dive":false,"gnaw":false,"do":"build","take":"mud"}');
    expect(m).toMatchObject({ do: 'build', take: 'mud' });
    expect(intentOf(m as never)).toMatchObject({ do: 'build', take: 'mud' });
    const bad = readToHost('{"t":"intent","x":0,"z":0,"do":"eat","take":"stash"}') as Record<string, unknown>;
    expect(bad.do).toBeUndefined();
    expect(bad.take).toBeUndefined();
  });
});
