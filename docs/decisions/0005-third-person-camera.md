# Third person camera

## Status

Accepted

## Context

Round 2 says the game is 3D and stylized (Q35). The camera was the first open
choice that follows from that. A throwaway demo in `prototypes/camera-demo/`
put four styles on the real south end of the Almsee: third person, top down,
side view, and a mix that switches between third person and top down near the
lodge. The author tried them and picked third person.

## Decision

- The game uses a third person camera that follows behind the beaver, with
  mouse or touch drag to turn the view and a zoom.
- Building (dams, lodge) is done from the same camera. If it feels cramped, a
  pull-back button or a longer zoom is the first thing to try, decided during
  the build.
- Top down, side view, and an automatic mix are not used for now.

## Consequences

- The camera has to stay out of trees, ground, and water, and handle diving
  (the view goes under water). The demo shows a workable first version.
- Movement is relative to the camera, so controls never change meaning
  mid-game. This was the main reason to leave out the automatic mix.
- The world needs enough detail close up, but far views can be simple. This
  helps the terrain size question, which is still open.
- Switching to another camera later is a new ADR that supersedes this one.
