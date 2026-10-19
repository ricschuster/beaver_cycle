# Stress test by script (#603)

`tools/stress/stress.mjs` plays the game by script for a set time and writes one JSON report. It uses the test menu and
`window.__game`, so it needs the dev server (the release build has neither, ADR 0013) and the local tiles.

## What a lap does

Six jumps (the six locations, 8 s each), a walk at x5 at each (15 s), then winter and one game year, a night's sleep, and a
dream. Every second lap ends with a reload that continues the save (the clock must not go back) and a background and resume
of the page (`Page.setWebLifecycleState` frozen, then active). `STRESS_MINUTES` sets how many minutes of laps are run.

Per phase it records the frame times (p50, p95, p99, worst, frames over 50 ms), the JS heap, and the GPU object counts, scene
geometries and ground bytes from `__game.memory()` (see `38_memory.md`).

## Running it

- Desktop: `npm run dev -- --port 5173 --strictPort`, then `npm run stress` (`STRESS_MINUTES=60`, `STRESS_REPORT=file`,
  `STRESS_BASELINE=earlier.json` to print the changes).
- Tablet: the live shell as in `tools/tablet-live/README.md` (dev server, `adb reverse`, app open, tablet unlocked), then
  `STRESS_TARGET=tablet npm run stress`. The run starts a new game in slot 4 of the picker (`STRESS_SLOT`), deleting what is there,
  so run it in a copy of the shell under its own app id, never in an install with a save you want: copy `tools/tablet-live`
  with `com.beavercycle.live` replaced by another id (also in `android/app/src/main/assets/capacitor.config.json`), build it with
  JDK 21, install it beside the others, and run with `STRESS_PACKAGE=<id> STRESS_URL=http://localhost:<port>/` and that port in
  `adb reverse` and the dev server. With more than one device, `ANDROID_SERIAL=<serial>`. Do not touch the tablet during a run. The run keeps the screen on while plugged in and puts the old setting back at the end; a tablet that dozes hides the page and
  every click times out. Unlock the tablet before the run.
- The run plays in English (`en-US` on the desktop) because it finds the picker's buttons by their text. It adds `save=1`, since an
  automated browser does not save otherwise.

## Failures and budgets

A run fails on a page error, a console error, a crash, a lost WebGL context, a continue that goes back in time, or a budget:

| What | Desktop | Tablet |
| --- | --- | --- |
| p95 frame time while walking | 25 ms | 33 ms |
| Frames over 50 ms a minute | 10 | 30 |
| JS heap growth after the first lap | 0.5 MB a minute | 0.5 MB a minute |

## Baseline (2026-10-18, session 152)

| | Desktop (GPU Chromium, 60 Hz) | Tablet (SM-X210, 90 Hz) |
| --- | --- | --- |
| Run | 17 min, 6 laps, 3 reloads | 31.6 min, 11 laps, 5 reloads |
| Walking p50 / worst p95 | 16.7 / 16.8 ms | 11.1 / 33.4 ms (three frames at 90 Hz) |
| Frames over 50 ms a minute | 0.9 | 12.9 |
| JS heap after a collection | 34 to 37 MB, flat between reloads | 33 to 36 MB at the end of each stretch, flat |
| Slope (the budget's measure) | 0.18 MB a minute | about 0 (the first run's 1.56 was the old measure on short stretches) |
| Worst single frame | 650 ms (a dream starting) | 926 ms (a dream starting); the worst jump 300 ms |
| Continue after a reload | clock kept every time | clock kept every time |
| Errors, context loss | none | none |

Geometries on the GPU and in the scene, textures and programs end each stretch at the same values as the one before (the tablet:
about 800 and 1250 in the scene, 7 textures, 20 programs), as in `38_memory.md`. The one finding is the stall at the start of a
dream (#638; on the desktop GPU the first draw's stall of about 290 ms is now 100 ms, the shader compile runs in the
background and the first draw is before the fade, the 400 ms to build the scene is left. On the tablet the worst frame of a dream is 400 to 600 ms (11 laps, session 153). It is not a
player problem: the first draw is under the sleep prompt's dark, and play has shown nothing. Staging the build was tried and dropped, see #638). The budgets above stay as first guesses; the tablet's p95 of 40 ms is wide because 33.4 ms is only three frames at
90 Hz, and tightening it waits for a second tablet and a longer run.

## Not done

- Chopping, dam and lodge building by hand are not in the lap (the playtests do those, too long for a loop).
- The run starts a new game; a very old save is not loaded.
- No CI job: it needs the tiles and a GPU.
