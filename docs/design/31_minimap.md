# The minimap (a trial)

Design note for a trial. The author wants a minimap "so we can orient ourselves a bit. Not sure if we want to keep it, so
just build it quickly to try." Status: built to try on a tablet, not decided. It is cheap and easy to take out again.

## What it shows

A round map, 140 px across, at the top right under the **?** and **Test** buttons. It covers 300 m of ground across
(150 m to the rim), centred on the beaver.

- **The ground**: land cover in soft colours (meadow light green, forest dark green, scrub, rock grey, wetland, bare
  ground sand), with a light hill shade lit from the north west so the valley sides read.
- **Water**: the lake and the ponds behind the player's dams, in one blue, and the streams as blue lines.
- **The beaver**: a yellow arrow in the middle, pointing the way it faces.
- **The view**: a faint wedge from the middle, the way the camera looks.
- **Home**: the lodge as a small brown dome. When home is farther than the rim, the dome sits on the rim, so the way home
  always shows.
- **North**: an **N** on the rim.

## North up or turning

It **turns with the camera**: up on the map is ahead on the screen, which is also up on the stick, since the stick moves
the beaver relative to the view. A lake on the left of the screen is on the left of the map. A child of 8 can steer by it
without turning a north up map in the head. The **N** on the rim keeps north in sight for the game's words, such as "a lone
beaver lives far to the north". `?minimap=north` keeps north up instead, to compare.

## Turning it on and off

- On by default, turning, so the author sees it when playing.
- The test menu has a **Minimap** row whose button goes Turning, North up, Off.
- `?minimap=0` starts with it off, `?minimap=north` with north up.
- An automated browser (the Playwright tests, the manual's pictures) starts with it off, so those stay as they were;
  `?minimap=1` turns it on there. One smoke test does.

## Cost

A 2D canvas, not three.js. The ground is sampled every 5 m into a 72 by 72 image when the beaver has moved 15 m, when a
pond changes, or every 8 s for tiles that were still loading, eight rows a frame so no frame pays for all of it. The map is
redrawn ten times a second from that image. About 1 ms per sampling frame on a desktop; to check on the tablet.

## Taking it out

It lives in `src/ui/minimap.ts` and `src/ui/minimap.test.ts`. The rest is a few lines: the import, the create, and the
`minimap.update` call in `src/main.ts`, the `minimap` option and row in `src/ui/testMenu.ts`, one smoke test in
`tests/e2e/smoke.spec.ts`, one paragraph in `public/manual.html`, and this note.

## Open questions for the author

1. Keep it or not, after playing with it on a tablet?
2. Size: 140 px and 300 m across. Bigger, smaller, more or less ground?
3. Turning with the camera, or north up? Try both with the test menu.
4. What else to mark: the dams and the dam rings, other families' lodges, the food store, a lone partner, lily pads,
   animals? Or less, to keep it calm?
5. Hide it in the lodge, or at night?
6. Should a tap on it open a bigger map?
