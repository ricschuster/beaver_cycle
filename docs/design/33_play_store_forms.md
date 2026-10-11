# Google Play forms and listing (draft)

Answers to prepare for the Play Console, so the forms are quick to fill. Background and sources are in issue #445; the
Play wording changes, so read each question again when filling it in (last checked 2026-10-11). Nothing here is filed yet.

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

Check before answering: `aapt2 dump permissions` on the release bundle shows only INTERNET (Capacitor adds it; the game
does not need it in the app), and the Capacitor plugin list has no analytics or ad plugin.

## Content rating (IARC)

Self reported. Expected answers: no violence beyond cartoon animals (predators exist, nothing dies, see the brief), no
sexual content, no profanity, no gambling, no user generated content, no sharing of location, no purchases, no ads. Expect
a low rating (Everyone / PEGI 3). Answer from the game as it is then; the talk lines and the "mate" and "kits" words are
about animal families.

## Target audience

6-8 and all older groups (mixed audience), decided in #445. Do not tick 5 and under. Try the first steps with one child of
6 to 8 before relying on it.

## Store listing (draft text)

Short description (80 characters at most):

> Be a beaver in a real Alpine valley. Build a lodge, raise a family.

Full description:

> Grow up in a beaver lodge in the real Almsee valley in Austria. Chop trees, build dams and a lodge of your own, find food
> through the seasons, meet other beaver families, and one day raise kits. Then you play the next generation, and the cycle
> goes on.
>
> A calm game: nobody dies and you cannot lose. No ads, no purchases, no accounts, and nothing about you is collected.
>
> Map data (c) OpenStreetMap contributors. Terrain from the BEV, Austria. Free software under the AGPL-3.0.

Graphics: use real screenshots from the game (`MANUAL_SHOTS`, tablet size). Do not use child-style cartoon art that the
game does not show.

## Still open

- A contact email for the store listing (Play requires one and may show it); the privacy page uses the GitHub issues link.
- Whether to keep INTERNET in the app manifest (the tiles are inside the app, so it may not be needed).
