# Web stack: TypeScript, Vite, and three.js

## Status

Accepted

## Context

The stack was the open choice after the camera (ADR 0005), the tablet target
(`docs/design/08_camera_and_platform.md`), and the streamed world (ADR 0006).
The game is a stylized 3D world on real terrain, played on tablets by the
author and friends. All of them use Android tablets, and play stays on the
local WLAN with no internet service. Single player comes first. Multiplayer
is still wanted but is not designed.

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

- Build the game as a web app in TypeScript with Vite and three.js. Chrome on
  Android is the target browser.
- Deliver it as a sideloaded Android APK made with Capacitor. The game files
  are packed in the app, so it needs no server and no app store. During
  development it runs from a Vite dev server on the WLAN.
- Use Playwright for browser tests and screenshots, and Blender for any
  models, run from the command line.
- Keep the data tools in Python (GDAL, numpy, Pillow). They write tiles that the
  game loads at run time.
- Single player first. Multiplayer stays out of the first playable but is kept
  in mind: game state and rules live in a simulation layer that does not touch
  rendering or input, so another device can later drive or mirror it.
- Test on a real Android tablet early, before the first playable is called
  done. If the budgets cannot be met in the web view, revisit this ADR with
  measured numbers and consider Godot.

## Multiplayer, open

Multiplayer is wanted, as friends on the same WLAN, with no internet service
and no dedicated laptop as server. It is decided later in its own ADR. The
routes to test then are Android Nearby Connections through a plugin, a small
server embedded in the app on one tablet, and WebRTC with manual pairing. A
web view cannot open a listening socket on its own, so hosting from a tablet
needs a native plugin and must be proven with a spike first. If no route
works, Godot, which has host and join built in, is the fallback.

## Consequences

- No app store and one build for every tablet. Updates mean installing a new
  APK on each tablet. The loop in development is edit, reload, look.
- Everything the engine would give for free is written by hand or taken from
  small libraries: animation, collision against terrain, water, input, audio,
  and save data. Plan time for it.
- Web view limits apply: memory, no background play, and audio that starts
  only after a touch.
- The camera demo's code stays throwaway, but its scene export and ideas are
  reused.
- If the tablet test fails, the cost of moving to an engine is high, because
  game code is not portable. This is why the tablet test comes first.
- `CLAUDE.md` (Stack, Commands, Repo structure) and
  `CONTRIBUTING.md` (Setup) are filled in, and a milestone plan follows.
