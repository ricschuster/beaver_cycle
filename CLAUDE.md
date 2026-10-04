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

Design phase, with no game code yet. Rounds 1 and 2 of the author's questions
are answered, round 3 (variety) is printed and awaits the author's answers, and
the stack is chosen (ADR 0007). The next milestone is a tablet test of the stack, then a
first playable of the core location on a tablet. Open GitHub issues are the
live task tracker. A draft milestone plan is in
`docs/design/13_milestone_plan.md`.

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
Terrain is BEV 5 m ([ADR 0002](docs/decisions/0002-terrain-source.md)). Tooling
is Python with GDAL, numpy, and Pillow. The camera demo in
`prototypes/camera-demo/` is throwaway. Game code is not started yet.

## Commands

No game commands yet. Everyday today (gate means CI blocks a merge on it):

- `npx markdownlint-cli '**/*.md' --ignore node_modules --ignore LICENSE` -
  lint docs (gate)
- `python3 tools/area-editor/build_data.py` - download and cache terrain and
  map data into `data/raw/` (untracked, about 60 MB)
- `python3 tools/area-editor/travel_graph.py` - rebuild travel links after a
  play shape changes
- `python3 prototypes/camera-demo/export_scene.py` - cut the camera demo scene
- `python3 scripts/build_question_docx.py QUESTIONS.md OUT.docx TEMPLATE.docx` -
  build a printable handout

Add run, test, and build once the stack is chosen; `CONTRIBUTING.md` Setup
should match.

## Repo structure

- `docs/design/` - the brief, the author's answers (rounds 1 to 3), and design
  notes. `docs/decisions/` holds ADRs, `docs/handoffs/` session handoffs.
- `data/areas/` - the play area shapes and travel links (tracked). `data/raw/`
  is downloaded data and untracked.
- `tools/area-editor/` - browser editor for the play area and its data build.
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
