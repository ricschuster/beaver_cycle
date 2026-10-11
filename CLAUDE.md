# CLAUDE.md

Working rules and durable context for this project. This file is loaded into
context automatically, so keep it to direction and rules, not a task list.

## Project name

Beaver Cycle

## Project purpose

A 3D, stylized game in which you play a beaver in the real Almsee valley in
Austria. You grow up in a lodge, build your own, raise a family, and play the
next generation, forever. It is for the author and friends, on tablets. See
`docs/design/00_project_brief.md` for the full brief.

## Project status

Playable on the real valley, in milestones M1 to M7 of
`docs/design/13_milestone_plan.md`. The game has terrain streaming, the beaver
and its camera, time and seasons, chopping, dams, ponds, lodges, food, wear and
repair, life stages and the next generation, achievements, ambient animals,
other families, partners, predators, the player interacting with animals,
and talking to and rescuing beavers of other families (`docs/design/27_families_and_dialog.md`)
(round 1 to 4 answers are in `docs/design/`). All six play locations have tiles
and animals; playing and tuning them on a tablet is still to do (#42). What is
left is mostly tuning on a tablet. Open GitHub issues are the live task tracker, and the
latest `docs/handoffs/` file says where the last session stopped.

## Scope

A calm game with no death and no losing, set on real terrain, faster than life
and stylized, not photoreal. Not a beaver simulation, not all six locations at
once (core first), and no release of OpenStreetMap derived data before its
licence is settled. Do not expand scope without a design note in
`docs/design/` or an ADR in `docs/decisions/`.

## Stack

Web app in TypeScript, Vite, and three.js, shipped as a sideloaded Android APK
with Capacitor ([ADR 0007](docs/decisions/0007-web-stack.md)). Android tablets
on a local WLAN, single player first, multiplayer kept in mind and open.
Stylized 3D with a third person camera
([ADR 0005](docs/decisions/0005-third-person-camera.md)), and a world streamed
in chunks, core first ([ADR 0006](docs/decisions/0006-streamed-world-core-first.md)).
Terrain is BEV 5 m ([ADR 0002](docs/decisions/0002-terrain-source.md)), with
2 m fine tiles near the lake from the BEV 1 m model
([ADR 0008](docs/decisions/0008-one-metre-terrain-near-ring.md)). Tooling
is Python with GDAL, numpy, and Pillow. The camera demo in
`prototypes/camera-demo/` is throwaway. Game code lives in `src/`.

## Commands

Everyday (gate means CI blocks a merge on it):

- `npm ci` - install the game dependencies
- `npm run dev` - Vite dev server, also on the WLAN for a tablet
- `npm run typecheck` - TypeScript check (gate)
- `npm test` - Vitest unit tests (gate)
- `npm run build` - type check and production build into `dist/` (gate)
- `npm run test:e2e` - Playwright browser smoke test (gate; `E2E_PORT=5191` if 5173 is taken; first run
  `npx playwright install chromium`)
- `npx playwright test tests/e2e/cycle.spec.ts` (also `build`, `dam`, `dams`, `life`, `locations`, `moves`) - playtests that play the real game with the keys and the test
  menu on the real valley; they skip without the local tiles, so CI skips them. `build` and `cycle` take 6 to 10 minutes; `dams` takes about 25 (a whole first dam by hand takes 20 of them, `-g "whole by real play"` runs it alone, `-g Pioneer` takes 2); `locations` (a dam raised to level 2 or 3 and a lodge pond in each of the six locations, about 7 minutes; `PLAYTEST_BUILD=1` adds a hand built lodge, not yet run);
  `PLAYTEST_SHOTS=dir` keeps screenshots, `PLAYTEST_DEBUG=1` prints misses. Helpers are in `tests/e2e/helpers.ts`
- `npx markdownlint-cli '**/*.md' --ignore node_modules --ignore LICENSE` -
  lint docs (gate)
- `python3 tools/area-editor/build_data.py` - download and cache terrain and
  map data into `data/raw/` (untracked, about 60 MB)
- `python3 tools/area-editor/travel_graph.py` - rebuild travel links after a
  play shape changes
- `python3 tools/tiles/build_tiles.py` - cut the play area into streamable tiles in
  `public/tiles/` (untracked, about 29 MB, 4 min; the first run also caches about
  80 MB of the BEV 1 m terrain in `data/raw/` for the fine tiles, ADR 0008); it also snaps the stream lines to the terrain channel, ADR 0010, `--no-snap` skips that; `python3 -m pytest tools/tiles`
  checks them (needs `data/raw/`)
- `MANUAL_SHOTS=public/manual npx playwright test tests/e2e/manual-shots.spec.ts` - retake the pictures in the manual from the real valley (needs the local tiles, 1 to 2 minutes; skips without `MANUAL_SHOTS`)
- `python3 tools/dam-sites/scan_dam_sites.py` - draft scan of the streams in `public/tiles/` for dam
  sites (writes `public/tiles/dam_sites.json`, 10 s; the test menu toggles them, `?damsites=1` starts with them on); `python3 -m pytest tools/dam-sites` checks it
- Pages: `.github/workflows/pages.yml` deploys `main` to https://ricschuster.github.io/beaver_cycle/ with the tiles from the `tiles` release (`tar -czf tiles.tar.gz -C public tiles`, then `gh release upload tiles tiles.tar.gz --clobber` after a tile rebuild)
- `npm run dev`, then open `/tools/model-preview/` - the beaver model alone, to check the look (query
  `?mode=swim&speed=1&carry=branch&coat=2&yaw=90&t=1`, or `?action=eat&carry=lily`; `t` freezes the time, drag turns the camera)
- `npm run dev`, then open `/tools/model-preview/animals.html` - one ambient animal alone (query
  `?kind=fox&moving=1&yaw=90&pitch=15&dist=3&t=2`; kinds as in `src/sim/animals.ts`)
- `npm run dev`, then open `/tools/prop-preview/` - the props (lodge, dam, logs, rocks, food store, lily pads) side by side with their meshes and
  triangles; `node tools/prop-preview/shoot.mjs out.png` screenshots it from a Vite server on port 5202 (`npx vite --port 5202 --strictPort`)
- `npm run dev`, then open `/tools/sound-preview/` - every sound of the game to play and rate (ok, thin, harsh, wrong), with its measurements; `SOUND_REPORT=dir npx vitest run src/audio/analyze.test.ts` writes a WAV of each sound and a table
- `npm run dev`, then open `/tools/sound-preview2/` - the open sound gaps only (code-made sounds listed in `SYNTH_GAPS`, and clips staged after the settled rounds, `SETTLED` in its `main.ts`; none open now), rated apart from the full page
- `npm run dev`, then open `/tools/music-preview/` - the generative music alone (Valley, Dream, Off), with its own volume sliders and the ambient layers to judge the loudness against (query `?mood=dream` starts on the first touch)
- `npm run dev`, then open `/tools/dream-preview/` - the candy land dream scene alone (query `?seed=N&t=2&tag=1&giggle=1`); in the
  game `?dream=1&seed=N` opens a dream at once, and the test menu has Dream now
- `python3 prototypes/camera-demo/export_scene.py` - cut the camera demo scene
- `python3 scripts/build_question_docx.py QUESTIONS.md OUT.docx TEMPLATE.docx` -
  build a printable handout

## Repo structure

- `docs/design/` - the brief, the author's answers (rounds 1 to 3), and design
  notes. `docs/decisions/` holds ADRs, `docs/handoffs/` session handoffs.
- `data/areas/` - the play area shapes and travel links (tracked). `data/raw/`
  is downloaded data and untracked.
- `tools/area-editor/` - browser editor for the play area and its data build.
- `tools/tiles/` - cuts terrain, land cover, and water into game tiles.
- `tools/tablet-live/` - Capacitor shell that loads the dev server on a tablet.
- `public/manual.html` - the player manual, shown in the game by the ? button (`src/ui/helpPanel.ts`). Update it when
  controls, HUD text, or rules change, and keep the first steps in step with `src/ui/coachSteps.ts` (the in-game coach). Written for kids from 8, short sentences, pictures in `public/manual/`.
- `src/` - the game. `sim/` is state and rules (no DOM, no three.js, no
  input; the ground comes in through its `Terrain` interface), `terrain/` is
  tile decoding, the tile store, and the streamer (no three.js), `actions/` is what the player wants as plain data plus the input
  devices that produce it, `render/` draws sim state with three.js and never
  changes it, `ui/` is DOM overlays such as the test menu. `tests/e2e/` holds the Playwright tests.
- `prototypes/` - throwaway demos, such as the camera demo. Not the game.
- `scripts/` - helpers such as the question handout builder.

## Working rules

- Branch from `main`; one short-lived branch per change. Open a pull request
  into `main`; CI must pass before merge.
- Conventional Commits (for example `feat: ...`, `fix: ...`, `chore: ...`,
  `docs: ...`).
- No em dashes in code, comments, docs, commit messages, or user-facing text.
- Significant technical or design decisions get an ADR in `docs/decisions/`.
- Design notes live in `docs/design/`; session handoffs in `docs/handoffs/`.
- Keep changes small and focused; update docs when behaviour or design changes.
