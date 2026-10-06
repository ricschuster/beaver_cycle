# Milestone plan

Draft. Written after ADR 0007 (web stack, Android APK, single player first).
It sets the order of work, not dates. Effort is not estimated until the tablet
test gives real numbers. Open GitHub issues stay the live task tracker.

The round 3 answers are in `12_round3_answers.md`, and the rules drawn from
them in `10_variety.md`. They shape M4 to M6 below.

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

## M4: Time and seasons (done 2026-10-05)

Result: the author checked it on the tablet and it is good, and confirmed the
broadleaf share. The shadow default stays at two cascades and is decided with
the quality budget (#120).

- Day and night clock, four seasons of ten days, and the lodge at half speed.
- The day length is 8 real minutes, doubled from the 4 proposed. The author
  played it and keeps it as is (#114).
- First slice built: the clock and date (`src/sim/clock.ts`), sky and light by
  time and season, a clock readout, and test menu buttons for the lodge (half
  speed) and sleep to dawn. The lodge is only a toggle until M5.
- Seasonal colours (`src/render/seasonLook.ts`): spring is fresher, summer is
  the base look, autumn turns ochre and brown, and winter is snow on meadows
  and a pale forest floor, with darker trees. Colours hold through the middle
  of a season and blend over three days at each turn. The ground is tinted in
  the shader by a per vertex weight, so tiles are not rebuilt; rock and lake
  bed keep their colour. Snow on branches and a seasonal lake are not
  done; they moved to the art pass (#105). The lake and sky are not tied to the
  season beyond the sky colour.
- Tree kinds (`src/terrain/trees.ts`): each tree is a conifer or a broadleaf
  tree, picked from its position, in 60 m stands (about three in ten are mostly
  broadleaf, the rest mostly conifer, about a quarter broadleaf overall).
  Conifers keep their cone and stay green. Broadleaf trees are a low crown on a
  trunk with a few branches: fresh green in spring, green in summer, orange in
  autumn, and bare in winter (the crown shrinks away over the three day blend,
  in the shadows too). In autumn they drop leaves
  (`src/render/fallingLeaves.ts`): up to 140 drifting leaves near the beaver,
  starting from the crowns of broadleaf trees within 45 m, ramping in and out
  over the three day blends. Tree kinds change which trees stand where, so the
  numbers are a first guess to look at on the tablet.
- Night sky (`src/render/nightSky.ts`): a moon that rises in the east and sets
  in the west over the night, 700 fixed stars, both fading in as the light goes,
  and a dark underwater colour at night.
- Sun and shadows: a directional sun that follows the clock and season
  (`src/render/sunShadow.ts`) and is drawn as a disc with a glow in the sky.
  Shadows are cascaded (three's CSM): a sharp map out to 70 m and a coarser one
  out to 800 m, faded together, so hills and far trees shade the valley too.
  Beyond 800 m the slope shading from the sun is all there is. Query switches
  for tablet tests: `?shadows=0`, `?cascades=1` (near only), `?shadowmap=1024`,
  and `?day=2&time=0.3` to start at a time of day. The test menu also has
  time of day, season, and shadow on/off buttons. Cost on the tablet is
  measured: two cascades run at 40 to 55 fps, one cascade at 55 to 65, and no
  shadows at the 90 Hz cap. The default is an open decision, see
  `16_shadow_cost.md`.
- Sleep through the night (Q65): in the lodge at night a bedtime panel offers
  "Sleep until morning" (fade to black, wake at dawn) and "Dream" (a placeholder
  dark screen with a wake button). The author wants both. The dream is to become
  a mini game later; the lodge is still a test toggle until M5.

## M5: Doing things

- Chop, eat, and carry. Build a dam and a lodge. Wear and repair.
- Starts the first tasks and the wood achievement.
- Wear: the dam wears out first, then the food store, and a worn dam looks
  broken (Q54). A glowing circle marks what needs repair (Q55). Ignored, it
  breaks and has to be rebuilt (Q56). No loss, only a chore.
- Repair is done by the beavers, or by building again (Q57). It is the same
  carry and place action as building, with no repair button. The design is in
  `15_build_and_repair.md`.
- Done so far, first slice (chop and carry): press E (or the Gnaw button) near
  a tree and stand still for 3 seconds to fell it. Big trees give two logs, small
  ones one, and the paws hold four (`src/sim/trees.ts`, all numbers a first guess
  to feel on the tablet). Moving stops the gnaw and the tree stands. A felled
  tree is a stable id from its position (to half a metre) in `WorldState.felled`,
  so it stays gone when its tile is rebuilt; only the near, detailed trees can be
  felled. A small HUD shows wood and trees felled (the count toward the 30 tree
  wood achievement). Not done: eating, placing wood, the dam and lodge, wear.

## M6: One life, then the next

- Baby, teenager, and leaving to start a family. Play the next baby.
- Kits come when the beaver grows up, and babies differ by color (Q58, Q59).
- A teenager who left can be met again, and the parents move about the pond
  (Q60, Q61).
- The dam and lodge from before stay and get old (Q63). Each generation starts
  in a different pond (Q64), so how the baby gets there is open.
- Other beavers: help, trade, and play (Q62). A visitor who notices the scent
  mounds becomes a new neighbor.

## Later

- **Desktop play.** The same build runs in a desktop browser with keyboard and
  mouse (WASD to move, mouse to turn, keys for actions), next to touch. Cost
  is mostly screen layout and checking the feel. Tablet stays the primary
  design. Whether saves move between devices is open.
- **Multiplayer.** Its own ADR, after a spike on Nearby Connections, an
  embedded server on one tablet, or WebRTC (ADR 0007). Single player first.
- **The other five locations,** one at a time, once the core feels right
  (ADR 0006).
- **Player speed-up,** press and hold, and the beaver never gets tired (Q66).
  The test menu multiplier in M2 is the first form of it.
- **Travel between locations, and dream side quests.** The dream at night is
  the round 3 idea for sleep (Q65). A placeholder is in place; the author wants
  it to become a mini game.
