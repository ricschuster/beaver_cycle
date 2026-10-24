import { describe, expect, it } from 'vitest';
import { STAGE_RULES } from '../sim/life';
import type { BeaverView } from './protocol';
import { friendBeaver } from './view';

const view = (extra: Partial<BeaverView>): BeaverView =>
  ({ id: 'g1', coat: { coat: 0, shade: 0 }, look: { hat: 0, scarf: 0, tail: 0, name: '' }, x: 0, y: 0, z: 0, mode: 'walk', heading: 0, pace: 0, chopping: false, ...extra }) as BeaverView;

describe('friendBeaver size', () => {
  it('draws a teenager at a teenager size, not a baby size', () => {
    const f = friendBeaver(view({ grown: false, stage: 'teenager' }));
    expect(f.stage).toBe('teenager');
    expect(f.scale).toBe(STAGE_RULES.teenager.scale);
  });

  it('draws a baby and an adult at their sizes', () => {
    expect(friendBeaver(view({ grown: false, stage: 'baby' })).scale).toBe(STAGE_RULES.baby.scale);
    expect(friendBeaver(view({ grown: true, stage: 'adult' })).scale).toBe(STAGE_RULES.adult.scale);
  });

  it('keeps the old rule for a host that sends no stage', () => {
    expect(friendBeaver(view({ grown: false })).stage).toBe('baby');
    expect(friendBeaver(view({})).stage).toBe('adult');
  });
});
