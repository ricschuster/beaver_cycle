# Dev tooling is a compile-time flag

## Status

Accepted (2026-10-16). Answers #550, a blocker for #445 (Google Play) and any other release route.

## Context

The game carries tools for the author: the test menu (location jumps, speed, stage, season, dream, dam tools), dev URL
parameters (`?stage=`, `?day=`, `?dream=`, `?damsites=` and more), and the `window.__game` view the Playwright playtests read.
They must not reach players. The playtests drive the real game through them, so they cannot simply be deleted.

## Decision

`__DEV_TOOLS__` is a constant that Vite replaces at build time (`vite.config.ts`, declared in `src/env.d.ts`).

- True for `npm run dev` (the dev server and every playtest) and `npm run build:devtools` (the Pages site, for tablet tuning).
- False for `npm run build`, the build that ships. Rollup then removes the code behind it, so the test menu is not in the
  bundle, not only hidden.

What it covers in `src/main.ts`: the test menu (a no-op `NO_TEST_MENU` stands in, so the frame loop is unchanged), the
`__game` hook, and every URL parameter except `touch`, `sound` and `grain` (`gameQuery` in `src/devTools.ts`).

`npm run check:release` fails when `dist/` holds strings that only the dev tools use. CI runs it after the release build.

## What stays

The dam site file `dam_sites.json` ships. The game uses it for the first dam spots and for where a beaver is placed, and the
test menu only toggles its marks. The dream stays: it is reached by sleeping.

## Consequences

- The playtests run on the dev build, so they do not prove the release build works. A release smoke test is a follow-up (#550).
- What a player still needs from the test menu lives in two release buttons: Settings (music and sound volume, the map, the shadows) and Things I did (the achievements). Both are in every build; the Test menu adds the dev rows on top.
- The marker strings in `scripts/check-release.mjs` must be kept in step with the test menu's labels.
