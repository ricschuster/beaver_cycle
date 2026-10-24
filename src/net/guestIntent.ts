// A guest's wishes between two sends to the host: a press of Do, a take, a gnaw, a dive tap. They are kept until the next intent goes
// out, which is SEND_HZ times a second, so a press between two sends is not lost. Plain data, so a test can check what is sent.
import type { DoKind } from '../sim/buttons';
import type { GuestDo, GuestTake, ToHost } from './protocol';

type Intent = Extract<ToHost, { t: 'intent' }>;

/** The presses of Do that the host acts on for a guest; a gnaw is kept apart, and `part` is asked as `partner`. */
const SENT: readonly string[] = ['build', 'mend', 'give', 'strip', 'partner', 'eat', 'store'];

export class GuestIntent {
  private gnaw = false;
  private act: Exclude<GuestDo, 'gnaw'> | null = null;
  private takeNow: GuestTake | null = null;
  private diveTap = false;

  /** What the player pressed this frame. */
  press(doPressed: DoKind | null, take: GuestTake | null, diveTap: boolean): void {
    if (doPressed === 'gnaw') this.gnaw = true;
    if (doPressed && SENT.includes(doPressed)) this.act = doPressed as Exclude<GuestDo, 'gnaw'>;
    // Asking to stop being partners is the same press: the host knows from the pairing which it is.
    else if (doPressed === 'part') this.act = 'partner';
    if (take) this.takeNow = take;
    if (diveTap) this.diveTap = true;
  }

  /** A partner wish from a card, not a press of Do. */
  partner(): void {
    this.act = 'partner';
  }

  /** The intent to send now, with the kept wishes spent. */
  send(move: { x: number; z: number }, dive: boolean): Intent {
    const out: Intent = { t: 'intent', x: move.x, z: move.z, dive, ...(this.diveTap ? { diveTap: true } : {}), gnaw: this.gnaw, ...(this.act ? { do: this.act } : {}), ...(this.takeNow ? { take: this.takeNow } : {}) };
    this.gnaw = false;
    this.diveTap = false;
    this.act = null;
    this.takeNow = null;
    return out;
  }
}
