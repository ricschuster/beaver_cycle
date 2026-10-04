# Milestone plan

Draft. Written after ADR 0007 (web stack, Android APK, single player first).
It sets the order of work, not dates. Effort is not estimated until the tablet
test gives real numbers. Open GitHub issues stay the live task tracker.

The numbering of this note leaves 12 free for the round 3 answers.

## Rules for every milestone

- Tablet first, judged on a real Android tablet.
- Game rules and state live in a simulation layer with no rendering or input
  code in it, so multiplayer can be added later (ADR 0007).
- The game reads actions (move, turn, dive, tail slap), never raw touch or key
  events. This keeps a second control scheme cheap (see Later).
- Each milestone ends with something to run and look at.

## M0: Tablet test (done 2026-10-04)

Result: the camera demo ran at 74 to 77 fps in every view on a Galaxy Tab A9+
with 150 MB of memory. Decision: go on with the web stack. Budgets are set in
M2.

Prove or disprove the stack before building on it.

- Check the Android System WebView version on each tablet, and whether the
  tablets have the Play Store.
- Install an APK with `adb` (or find the route that parental controls allow).
- Run the camera demo scene in a Capacitor APK. Record frame rate, memory, and
  load time, and set the triangle and tree budgets from the numbers.
- Decide: go on with the web stack, or revisit ADR 0007 (Godot).

## M1: Scaffold

- Project set up (TypeScript, Vite, three.js, Playwright), with CI running
  type checks and tests next to the docs lint.
- The simulation layer, the action layer, and a render layer, each separate.
- Fill in Commands in `CLAUDE.md` and Setup in `CONTRIBUTING.md`.

## M2: Streamed core

- Terrain tiles from the Python tools, loaded in chunks around the beaver,
  with coarser tiles and fog farther out (ADR 0006).
- Water and trees per tile. Test menu with the speed multiplier and a jump to
  any location.
- The build order and open decisions are in
  `14_m2_streamed_core_plan.md`.

## M3: The beaver moves

- Third person beaver that walks, swims, and dives, with the speeds in
  `09_game_length_and_speed.md`. Camera handles trees, ground, and water.
- Breath meter, with a short breath time. Touch controls as in
  `08_camera_and_platform.md`.

## M4: Time and seasons

- Day and night clock, four seasons of ten days, and the lodge at half speed.
- The day length is still open (4 real minutes proposed).

## M5: Doing things

- Chop, eat, and carry. Build a dam and a lodge. Wear and repair.
- Starts the first tasks and the wood achievement.

## M6: One life, then the next

- Baby, teenager, and leaving to start a family. Play the next baby.
- Shaped by the round 3 answers on variety.

## Later

- **Desktop play.** The same build runs in a desktop browser with keyboard and
  mouse (WASD to move, mouse to turn, keys for actions), next to touch. Cost
  is mostly screen layout and checking the feel. Tablet stays the primary
  design. Whether saves move between devices is open.
- **Multiplayer.** Its own ADR, after a spike on Nearby Connections, an
  embedded server on one tablet, or WebRTC (ADR 0007). Single player first.
- **The other five locations,** one at a time, once the core feels right
  (ADR 0006).
- **Player speed-up, travel between locations, and dream side quests.**
