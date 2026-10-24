// A guest's side of a dream run by the host (#665): the wish waiting for the host's first frame, the input gathered for the host, and
// the room ending the dream. Seconds are passed in, so a test can step them; main.ts only wires it to the dream screen and the link.
import type { DreamInput } from '../sim/dream';
import { mergeInput } from './dreamWire';

/** How long a guest waits for the host's first dream frame before it wakes, in seconds. */
export const DREAM_WAIT = 5;
/** How long the snapshots may carry no dream, while the screen is open, before the guest wakes too, in milliseconds. */
export const DREAM_GONE = 2000;

export class GuestDream {
  private asked: { at: number } | null = null;
  private sent: DreamInput | null = null;
  private noDream = 0;

  /** The guest asked the host for a dream. */
  ask(now: number): void {
    this.asked = { at: now };
  }

  /** Input from the dream screen, kept (merged) until the next send. */
  steer(input: DreamInput): void {
    this.sent = mergeInput(this.sent, input);
  }

  /** The input to send now, if any; its one-shot presses are spent, the held ones stay for the next send. */
  take(): DreamInput | null {
    const out = this.sent;
    this.sent = out && { ...out, hop: false, slap: false, play: false, pick: undefined };
    return out;
  }

  /**
   * While the screen is not open: `open` once the host's first frame is there, `giveUp` when none came in time, else null.
   * Either one ends the wait; opening also drops the input of the wish.
   */
  waiting(hasWire: boolean, now: number): 'open' | 'giveUp' | null {
    if (!this.asked) return null;
    if (hasWire) {
      this.asked = null;
      this.sent = null;
      return 'open';
    }
    if (now - this.asked.at > DREAM_WAIT) {
      this.asked = null;
      return 'giveUp';
    }
    return null;
  }

  /** While the screen is open: true when the room ended the dream (no dream in the snapshots for `DREAM_GONE` ms), once. */
  ended(hasWire: boolean, now: number): boolean {
    this.noDream = hasWire ? 0 : this.noDream || now;
    if (this.noDream && now - this.noDream > DREAM_GONE) {
      this.noDream = 0;
      return true;
    }
    return false;
  }
}
