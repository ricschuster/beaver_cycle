# Web stack: TypeScript, Vite, and three.js

## Status

Proposed

## Context

The stack was the open choice after the camera (ADR 0005), the tablet target
(`docs/design/08_camera_and_platform.md`), and the streamed world (ADR 0006).
The game is a stylized 3D world on real terrain, played on tablets by the
author and friends, with online multiplayer wanted but not designed.

Two routes were weighed:

- **Web app.** TypeScript, Vite, and three.js. It runs in the tablet browser on
  iPad and Android with no app store, installs as a home screen app, and
  updates by reloading. The camera demo already uses three.js, and the
  terrain, water, and forest export carries over. It can be built, run, and
  tested here with Node and headless Chromium. The author's crosstown project
  uses the same tools.
- **Game engine (Godot or Unity).** Better tools for animation, physics, and
  scenes, and native tablet builds with more headroom. Against it: the editor
  is a GUI, so working in it from this setup is awkward. Native builds need
  app store or sideload steps per device. A web export of an engine is large
  and often slower on a tablet than hand written three.js. Unity adds a licence
  question.

The world is mostly terrain, water, and trees, which suits three.js and
chunk streaming that this project writes itself. The open risk is tablet
performance, which has only been checked in headless Chromium.

## Decision

- Build the game as a web app in TypeScript with Vite and three.js.
- Use Playwright for browser tests and screenshots, and Blender for any
  models, run from the command line.
- Keep the data tools in Python (GDAL, numpy, Pillow). They write tiles that the
  game loads at run time.
- Test on a real tablet early, before the first playable is called done. If
  the budgets cannot be met in the browser, revisit this ADR with measured
  numbers and consider a native wrapper (for example Capacitor) before an
  engine.
- Multiplayer connection is not decided here. A web app leaves it open: a small
  WebSocket server is the likely route. It gets its own ADR once round 3 and
  the multiplayer design say what friends share.

## Consequences

- No app store, one build for every tablet, and a fast loop: edit, reload,
  look.
- Everything the engine would give for free is written by hand or taken from
  small libraries: animation, collision against terrain, water, input, audio,
  and save data. Plan time for it.
- Browser limits apply: memory per tab, no background play, and audio that
  starts only after a touch.
- The camera demo's code stays throwaway, but its scene export and ideas are
  reused.
- If the tablet test fails, the cost of moving to an engine is high, because
  game code is not portable. This is why the tablet test comes first.
- After acceptance, `CLAUDE.md` (Stack, Commands, Repo structure) and
  `CONTRIBUTING.md` (Setup) are filled in, and a milestone plan follows.
