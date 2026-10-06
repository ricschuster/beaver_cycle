# The lodge interior is drawn in its own scene

## Status

Accepted (2026-10-06). It replaces the room that hung 3000 m above the world
(session 26).

## Context

The inside of the lodge is a round room. It first hung 3000 m above the lodge in
the same three.js scene as the world, so the outside could not show through. The
terrain, water and trees still drew below it, and at some camera angles the
ground showed past the floor or the dome. The 3000 m offset also costs float
precision. The room must grow to hold up to 7 beavers, more than the dome's
footprint outside.

## Decision

The room lives in a scene of its own (`createLodgeInterior`), which the renderer
draws instead of the world while the beaver is in. The beaver model moves
between the two scenes. The room is placed at the lodge's spot with no lift, so
the sim and the camera keep world x and z, and the sim needs no separate
interior frame. The camera is kept under the ceiling and inside the dome's width
at its height. The room is 6 m in radius and 3.5 m high, with a water hole at the
centre and 7 nests round the wall.

## Consequences

- Nothing of the world can show inside, at any angle, and the world costs nothing
  to draw while inside.
- No 3000 m offset, so no precision loss.
- The sim still keeps interior positions in world coordinates at the lodge, so
  the room can be any size only because inside the sim ignores trees. A later
  family or second room may want its own local frame.
