import { describe, expect, it } from 'vitest';
import { noPartnerSeen, partnerNews, seenNow, type Pairing } from './partnerNews';

const none: Pairing = { askedBy: [], asking: [], partner: null, stopBy: false, stopping: false };

describe('partner news', () => {
  it('says nothing when nothing changed', () => {
    expect(partnerNews(none, noPartnerSeen(), null)).toBeNull();
    const together = { ...none, partner: 'b' };
    expect(partnerNews(together, seenNow(together, noPartnerSeen(), 'Bo', 5), 5)).toBeNull();
  });

  it('tells of a new partner', () => {
    expect(partnerNews({ ...none, partner: 'b' }, noPartnerSeen(), 5)).toEqual({ key: 'toast.partnered', about: 'b', urgent: false, kits: false });
  });

  it('tells of kits, urgently, when the partnership ends and the age changed, else that it stopped', () => {
    const seen = { ...noPartnerSeen(), partner: 'b', name: 'Bo', born: 5 };
    expect(partnerNews(none, seen, 99)).toEqual({ key: 'toast.kitsBorn', about: null, urgent: true, kits: true });
    expect(partnerNews(none, seen, 5)).toEqual({ key: 'toast.partnerStopped', about: null, urgent: false, kits: false });
  });

  it('tells of a question to stop, asked of the player or by it, only the first time', () => {
    const together = { ...none, partner: 'b' };
    const seen = seenNow(together, noPartnerSeen(), 'Bo', 5);
    expect(partnerNews({ ...together, stopBy: true }, seen, 5)?.key).toBe('toast.partnerStopAsked');
    expect(partnerNews({ ...together, stopping: true }, seen, 5)?.key).toBe('toast.partnerStopAsk');
    const asked = seenNow({ ...together, stopBy: true }, seen, 'Bo', 5);
    expect(partnerNews({ ...together, stopBy: true }, asked, 5)).toBeNull();
  });

  it('tells of a new ask for partners, from the first asker, only when there are more than before', () => {
    expect(partnerNews({ ...none, askedBy: ['c'] }, noPartnerSeen(), 5)).toEqual({ key: 'toast.partnerAsked', about: 'c', urgent: false, kits: false });
    expect(partnerNews({ ...none, asking: ['d'] }, noPartnerSeen(), 5)).toEqual({ key: 'toast.partnerAsk', about: 'd', urgent: false, kits: false });
    const seen = seenNow({ ...none, askedBy: ['c'] }, noPartnerSeen(), null, 5);
    expect(partnerNews({ ...none, askedBy: ['c'] }, seen, 5)).toBeNull();
  });

  it('keeps the partner\'s name once it is gone', () => {
    const together = { ...none, partner: 'b' };
    const seen = seenNow(together, noPartnerSeen(), 'Bo', 5);
    expect(seenNow(none, seen, null, 5).name).toBe('Bo');
  });
});
