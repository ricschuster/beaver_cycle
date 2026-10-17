# Languages: German and French (#600)

Status: proposal, to be agreed with the author before any code. English stays the default and the fallback.

## What the code looks like today

- About 360 string literals are spread over `sim/talkLines.ts` (143), `sim/achievements.ts` (87), `ui/coachSteps.ts` (60),
  `sim/chatter.ts` (55), `ui/dreamScreen.ts` (17), and a handful each in `main.ts`, `ui/helpPanel.ts`, `ui/slotCard.ts`,
  `ui/settingsPanel.ts` and others.
- The text is not only in `ui/`. `sim/` builds finished English sentences: `wayToPartner.ts` returns "to your left, close by",
  `chatter.ts` and `talkLines.ts` fill `{to}`, `{from}`, `{where}` into lines, `coachSteps.ts` builds steps from world state.
  So "sim emits keys, ui turns them into text" (the idea in the issue) would mean reworking the sim modules and their tests,
  which assert on English words (24 test files, plus about 10 lookups in `tests/e2e/`).
- `public/manual.html` (27 KB) and `public/privacy.html` are separate static pages.
- Settings choices are kept in `localStorage` through `SaveStorage`, like the volumes and shadows.

## Decisions proposed

### 1. A small own layer, no library

`src/i18n/` holds a `Lang = 'en' | 'de' | 'fr'`, one table per language (`en.ts`, `de.ts`, `fr.ts`), and `t(key, params?)`.
No dependency (ADR 0007 keeps the bundle small, and the needs are small). A table is a plain object of string, string
arrays (for the pick-one-of-several talk lines) and functions are not allowed, so a table is data a translator can read.
`en.ts` is the source of truth and defines the `Key` type; `de.ts` and `fr.ts` are typed against it, so a missing key is a
compile error and also a unit test failure (every key in every language, same placeholders, same array lengths).
Placeholders keep today's `{to}` style.

### 2. The sim stays DOM free, and keeps its pure functions

Do not rewrite the sim to emit keys. Instead the text modules (`talkLines`, `chatter`, `achievements`, `wayToPartner`,
`coachSteps`) read their words through `t()` with a language held in module state set once at start (`setLang`). They stay
pure for a given language, no DOM, no three.js, so the sim rules are untouched. Picks use the same index in every language
(the arrays are the same length), so a save, a seed or a test gives the same line, only in other words.
Rejected: keys through the whole sim (big refactor, risk to 24 test files, and little gain for one language switch).

### 3. Grammar

German and French have gender and agreement, so sentences are whole strings per language, never glued from pieces.
Where today's code joins pieces (`from()` in `talkLines.ts`, `placeWords`), each such piece becomes one key with its
own parameters, and the translator writes the whole phrase. Beaver names stay as they are.

### 4. Choosing the language

First start: the device language (`navigator.language`), `de*` or `fr*` else English. Settings gets a language choice
(Auto, English, Deutsch, Français) kept like the other choices. Changing it reloads the game after saving, as the
shadows choice does, so no live re-render is needed. Saves hold no text, so they work in any language.
The HUD, buttons and cards are checked for German text length on a phone and a tablet (screenshots per language).

### 5. Static pages

`manual.html` and `privacy.html` get one file per language (`manual.de.html`, `manual.fr.html`,
`privacy.de.html`, `privacy.fr.html`), picked by the same setting; English stays the default file. Two copies per language
is simple, and the manual changes rarely. A check in CI compares the headings of each so a section cannot go missing.

### 6. Fixed names

Almsee, place names and the OpenStreetMap credit stay as they are ([ADR 0003](../decisions/0003-openstreetmap-data-use.md)).
The test menu and dev tools stay English only (`__DEV_TOOLS__` code is not translated).

### 7. Translation quality

Machine translation gives the first draft, the author reads German, a French reader is needed for French (to find).
Talk lines are short and playful (a kit is cheeky, a mama warm, a papa practical, `talkLines.ts`), so they get a read by
a native speaker before release. Until reviewed, a language is marked draft in Settings.

### 8. Play listing

`tools/standalone-apk/store/listing.md` gets a German and a French section, and the screenshots are retaken per language
(`MANUAL_SHOTS` style spec with the language set). Play takes them per language in the Console.

## Steps (each its own pull request)

1. `src/i18n/` with `en` only, the test, the Settings choice, and the move of `ui/` strings (buttons, HUD, settings, slot cards).
2. The sim text modules, one per pull request, English tables first so nothing changes for players.
3. German tables, then the manual and privacy page in German.
4. French the same way.
5. Listing text and screenshots.

## Open questions for the author

- Is a draft marker in Settings wanted, or just ship once the author has read German?
- Who reads the French? (Needed before French goes into the Play build.)
- Should Auto follow the device, or always start English and let the player pick?
