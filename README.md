# Beaver Cycle

A calm, stylized 3D game in which you play a beaver in the real Almsee valley
in Austria. You grow up in a lodge, build a dam and a lodge of your own, find a
mate, raise kits, and then play the next generation, forever. There is no death
and no losing. It is made for the author and friends to play on Android
tablets, and it also runs in a desktop browser.

It is not a beaver simulation. The terrain is real (BEV elevation data and
OpenStreetMap), but time runs faster than life and the look is stylized, not
photoreal.

## How to play

The manual is [`public/manual.html`](public/manual.html). It is a plain page that
the game shows over itself: a **?** button at the top right opens it, and the
first start shows a short welcome card with a link to it. Keep it in step with
the controls (`src/ui/keyHints.ts`, the touch buttons) when they change.

The privacy policy for the store listing is [`public/privacy.html`](public/privacy.html); the Play form answers are in
`docs/design/33_play_store_forms.md`.

## What you can do today

- Walk, swim, and dive in a world streamed in tiles around you, across six
  play locations (the core by the lake first).
- Chop trees, eat, and carry logs, then build dams, ponds, a lodge, and a food
  store. Things wear out and need repair.
- Live through day and night and four seasons. Winter means food stored ahead.
- Grow from baby to teenager to adult, meet other beaver families and animals,
  find a partner, and start the next generation.
- Earn achievements and follow the guides.

The design is in [`docs/design/`](docs/design/), starting with the brief
([`00_project_brief.md`](docs/design/00_project_brief.md)). The order of work is
in [`13_milestone_plan.md`](docs/design/13_milestone_plan.md), and open GitHub
issues are the live task tracker.

## Run it

You need Node 22 or newer.

```bash
npm ci                          # install
npm run dev                     # dev server, also on the WLAN for a tablet
```

Open the printed URL. On a desktop, the key hints on screen show the controls;
on a tablet, touch controls are used.

The terrain tiles are not in the repository (they are derived from downloaded
data). Without `public/tiles/` the game has no valley to load. To build them,
which needs Python with GDAL, numpy, and Pillow:

```bash
python3 tools/area-editor/build_data.py   # download and cache data into data/raw/
python3 tools/tiles/build_tiles.py        # cut the play area into public/tiles/
```

See `CLAUDE.md` for the full command list, including the tests, the playtests
that play the real game, and the dam site scan.

## Checks

```bash
npm run typecheck && npm test && npm run build && npm run test:e2e
npx markdownlint-cli '**/*.md' --ignore node_modules --ignore LICENSE
```

CI runs these (see `.github/workflows/ci.yml`). The first e2e run needs
`npx playwright install chromium`. The long playtests in `tests/e2e/` skip
without the local tiles, so CI skips them.

## On a tablet

The game ships as a sideloaded Android APK built with Capacitor
([ADR 0007](docs/decisions/0007-web-stack.md)).

- [`tools/tablet-live/`](tools/tablet-live/README.md) loads the dev server over
  the WLAN, so a code change needs no APK rebuild. For development.
- [`tools/standalone-apk/`](tools/standalone-apk/README.md) bundles the built
  game in an APK that plays with no computer. Debug build, for local testing
  only: the tiles come from OpenStreetMap data, so they are ODbL
  ([ADR 0003](docs/decisions/0003-openstreetmap-data-use.md)).

## Layout

- `src/`: the game. `sim/` is state and rules (no DOM, no three.js, no input),
  `terrain/` decodes and streams tiles, `actions/` is what the player wants as
  plain data plus the input devices, `render/` draws sim state with three.js,
  `ui/` is the DOM overlays such as the test menu.
- `tests/e2e/`: Playwright smoke test and playtests.
- `tools/`: Python data tools (`area-editor/`, `tiles/`, `dam-sites/`) and the
  Capacitor shells for the tablet.
- `data/areas/`: the play area shapes and travel links. `data/raw/` is
  downloaded data and untracked.
- `docs/`: `design/` notes and the author's answers, `decisions/` ADRs,
  `handoffs/` session handoffs.
- `prototypes/`: throwaway demos (the camera demo, the M0 tablet test). Not the
  game.
- `scripts/`: helpers such as the question handout builder and
  `bootstrap-repo-settings.sh`.

## Contributing

This is a solo project for now. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the
workflow and [`CLAUDE.md`](CLAUDE.md) for the working rules used with Claude
Code.

## Repo automation

PRs opened by the repository owner arm squash auto-merge
(`.github/workflows/auto-merge.yml`), and `update-branches.yml` brings armed
PRs level with `main` after each push to it. Both need the `AUTO_MERGE_TOKEN`
secret: a fine-grained personal access token for this repo only (Contents, Pull
requests and Workflows: read/write). `GITHUB_TOKEN` cannot be used, because
GitHub starts no workflows for pushes made with it, so the PR's checks would
never run on the updated branch. Rotate the token before it expires.
`scripts/bootstrap-repo-settings.sh` sets branch protection, auto-merge, and
labels (needs the GitHub CLI with admin access).

## Data sources

- Water and land cover: &copy; OpenStreetMap contributors, ODbL
  ([copyright](https://www.openstreetmap.org/copyright)). The repo holds no
  OpenStreetMap extract; `tools/area-editor/build_data.py` downloads it into
  untracked `data/raw/`, and the game tiles built from it are untracked too
  (published as the `tiles` release and on the Pages site, under the ODbL)
  ([ADR 0003](docs/decisions/0003-openstreetmap-data-use.md)). The screenshots
  in `public/manual/` are drawn from it and credited in the manual.
- Terrain: BEV, Austria (CC BY 4.0), see [ADR 0002](docs/decisions/0002-terrain-source.md).

## License

Copyright (c) 2026 Richard Schuster. The code and the author's own content are
licensed under the GNU Affero General Public License v3 (`LICENSE`): you may
use and change them, but a changed version that others play, also as a web
page, must be shared under the same licence. Map data, terrain and sounds from
others keep their own licences, see [`NOTICE.md`](NOTICE.md).
