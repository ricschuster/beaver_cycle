# Google Play forms and listing (draft)

Answers to prepare for the Play Console, so the forms are quick to fill. Background and sources are in issue #445; the
Play wording changes, so read each question again when filling it in (last checked 2026-10-11). The developer account is
set up (2026-10-17). The forms and the store listing were filed in the Console on 2026-10-17 (see the session 142 handoff).

## Release bundle

`tools/standalone-apk/build_aab.sh` builds the signed `.aab` (steps in that folder's README). Built 2026-10-17 from `main`:
`com.beavercycle.game`, `versionCode` 1, `versionName` 1.0, `minSdk` 24, `targetSdk` 36, about 34 MB, no native libraries,
no `INTERNET`. Raise `versionCode` for every later upload. Rolled out to the internal testing track on 2026-10-17 and played from Play on a phone.

## Privacy policy

`public/privacy.html`, served at <https://ricschuster.github.io/beaver_cycle/privacy.html>. Use that URL in the Play
Console. It says the game collects nothing, which holds as long as `src/` has no network call except same-origin `fetch`
for tiles and sounds, and no analytics. Re-check this before each release, and change the page first if it stops being true.

## Data safety form

| Question | Answer | Why |
| --- | --- | --- |
| Does the app collect or share any user data? | No | Nothing leaves the device; the save is in local storage |
| Is all data encrypted in transit? | Not asked when nothing is collected | Tiles load from the app itself |
| Can users ask to delete their data? | Not applicable | Uninstalling deletes the save |

Checked 2026-10-17: the release bundle declares no permission of its own (`build_aab.sh` removes the `INTERNET` that
Capacitor adds, since the tiles and sounds are inside the app; the only entry is AndroidX's own receiver permission), and the
Capacitor plugin list has no analytics or ad plugin. The only `fetch` calls in `src/` are same-origin (tiles, sounds, dam
sites). Check again before each release.

## Content rating (IARC)

Self reported. Expected answers: no violence beyond cartoon animals (predators exist, nothing dies, see the brief), no
sexual content, no profanity, no gambling, no user generated content, no sharing of location, no purchases, no ads. Expect
a low rating (Everyone / PEGI 3). Answer from the game as it is then; the talk lines and the "mate" and "kits" words are
about animal families.

## Target audience

6-8 and all older groups (mixed audience), decided in #445. Do not tick 5 and under. The game was played for a few hours
by a 9 year old (2026-10-17); a child of 6 to 8 has not tried it. Because the audience includes under 13s, read Play's
Families policy when filling in the form.

## Store listing

The text (name, short and full description, category, contact) is in `tools/standalone-apk/store/listing.md`, written for readers
from 9 up. The graphics are in `tools/standalone-apk/store/` (icon, feature graphic, eight real tablet screenshots, see the
standalone-apk README). Use real screenshots from the game, not child-style cartoon art that the game does not show.

## Contact

The store listing and the privacy page use <ric.schuster@gmail.com> (chosen by the author, 2026-10-11). Play may show it publicly.

## Still open

- Read the pre-launch report once it has data.
- 12 or more closed testers for 14 days (#445).
