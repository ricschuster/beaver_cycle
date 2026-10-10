// The dream's scene (docs/design/29_dream_candy_land.md): candy land drawn with three.js on its own canvas, made when a dream
// starts and thrown away on waking. It reads the dream's state and never changes it.
import type { Coat } from '../sim/family';
import type { DreamEvent, DreamLand, DreamState } from '../sim/dream';
import type { ViewState } from './cameraRig';

export interface DreamView {
  /** The canvas, which also takes the camera's drag and zoom input (`createCameraRig`). */
  canvas: HTMLCanvasElement;
  /** Draw the dream as it is, from the view. `events` are this step's, for little effects such as a sparkle on a sweet. */
  draw(state: DreamState, view: ViewState, events: readonly DreamEvent[]): void;
  /** Free the GPU memory and remove the canvas. */
  dispose(): void;
}

/** The scene for one night's land, with the player's beaver in its own coat. The canvas fills `parent`. */
export function createDreamView(parent: HTMLElement, land: DreamLand, coat: Coat): DreamView {
  void land;
  void coat;
  const canvas = document.createElement('canvas');
  parent.append(canvas);
  return {
    canvas,
    draw() {},
    dispose() {
      canvas.remove();
    },
  };
}
