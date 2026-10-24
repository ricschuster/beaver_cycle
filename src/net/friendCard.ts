// What the talk card offers by a friend who is a player (#667): to be partners (or stop, or say yes to an ask), a few questions, a few friendly phrases (#802), hide and seek,
// and Bye. Pure, so a test can check the buttons. The words are in the language tables.
import { t } from '../i18n';
import type { pairingOf } from './view';
import { QUESTIONS, type PhraseId } from './says';

export interface FriendChoice {
  /** 'partner', a question id, 'hide' (a game of hide and seek, #664), or 'bye'. */
  id: string;
  label: string;
}

/**
 * The buttons of the card by the friend `id`. `pairing` is what the snapshot says to this player (`pairingOf`), and `canPartner`
 * is true when both could be partners (adults, no partner yet, close). `phrases` are the friendly words the card offers this time
 * (`pickPhrases`), after the questions.
 */
export function friendChoices(id: string, pairing: ReturnType<typeof pairingOf>, canPartner: boolean, phrases: readonly PhraseId[] = []): FriendChoice[] {
  const out: FriendChoice[] = [];
  if (pairing.partner === id) out.push({ id: 'partner', label: t(pairing.stopBy ? 'friend.partYes' : 'friend.part') });
  else if (!pairing.partner && canPartner) out.push({ id: 'partner', label: t(pairing.askedBy.includes(id) ? 'friend.partnerYes' : 'friend.partner') });
  for (const q of QUESTIONS) out.push({ id: q, label: t(`friend.q.${q}`) });
  for (const p of phrases) out.push({ id: p, label: t(`friend.q.${p}`) });
  out.push({ id: 'hide', label: t('friend.hide') });
  out.push({ id: 'bye', label: t('friend.bye') });
  return out;
}
