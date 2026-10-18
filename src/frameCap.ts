// A frame rate cap for the draw loop (#605). requestAnimationFrame follows the screen, which is 120 Hz on a recent phone and 90 Hz on
// the tablet, and the game redraws the whole valley on every call. Measured on a Pixel 9 Pro (session 150): 60 fps instead of 116
// halved the game's power use and left the phone cool. The cap skips the calls that come early; the others draw as before.

/** The default cap in frames per second. */
export const FRAME_CAP_FPS = 60;

export interface FrameCap {
  /** True when the frame at `now` (a requestAnimationFrame timestamp, in ms) should be drawn. Call it once per frame. */
  due(now: number): boolean;
}

/**
 * Draws at most `fps` frames a second. The next draw is aimed at the previous aim plus one interval, not at the last draw, so a
 * late frame does not push the rate down; a long stall starts the count again. A frame may come a fifth of an interval early and
 * still draw, since the timestamps jitter and a 60 Hz screen must not lose frames to a 60 fps cap. 0 or less means no cap.
 */
export function createFrameCap(fps: number): FrameCap {
  if (!(fps > 0)) return { due: () => true };
  const interval = 1000 / fps;
  const early = interval * 0.2;
  let next = 0;
  return {
    due(now) {
      if (now < next - early) return false;
      next = now - next > interval ? now + interval : next + interval;
      return true;
    },
  };
}
