# Languages: German first (#600)

Status: agreed with the author on 2026-10-17. English stays the default and the fallback. German comes first and French is
left out for now (no French reader available); the layer is built so a third language is one more table.

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

`src/i18n/` holds a `Lang = 'en' | 'de'`, one table per language (`en.ts`, `de.ts`), and `t(key, params?)`.
No dependency (ADR 0007 keeps the bundle small, and the needs are small). A table is a plain object of string, string
arrays (for the pick-one-of-several talk lines) and functions are not allowed, so a table is data a translator can read.
`en.ts` is the source of truth and defines the `Key` type; `de.ts` is typed against it, so a missing key is a
compile error and also a unit test failure (every key in every language, same placeholders, same array lengths).
Placeholders keep today's `{to}` style.

### 2. The sim stays DOM free, and keeps its pure functions

Do not rewrite the sim to emit keys. Instead the text modules (`talkLines`, `chatter`, `achievements`, `wayToPartner`, `news`,
`coachSteps` and the HUD formatters) read their words through the layer with the language set once at start (`setLang`). They stay
pure for a given language, no DOM, no three.js, so the sim rules are untouched. Picks use the same index in every language
(the arrays are the same length), so a save, a seed or a test gives the same line, only in other words.

Built so far:

- `tree('talk.remark')` gives a read-only view of the keys below a prefix as nested objects, read when indexed, so
  `REMARK.mama.wary` still works in the code and follows the language. The tables of talk lines, achievements and the like are such views.
- The exchanges between beavers (`chatter`) are keys named `<caller side>-<answerer side>-<n>.call` and `.reply`
  (`parent-kit-2`), so the pair of sides who may say a line is part of the key and a translation keeps it.
- Text with a number or a name is a whole phrase with placeholders (`'{felled} of {need} trees felled'`), and a plural is two
  keys (`one`, `many`). The status line top left is a list of short clauses joined with ", ", each clause one key.
- `i18n/index.test.ts` checks the keys the code builds at run time (seasons, stages, predators, achievements, coach steps)
  exist, and that every shipped language has every key with the same placeholders.

Rejected: keys through the whole sim (big refactor, risk to 24 test files, and little gain for one language switch).

### 3. Grammar

German has gender and agreement (as French would), so sentences are whole strings per language, never glued from pieces.
Where today's code joins pieces (`from()` in `talkLines.ts`, `placeWords`), each such piece becomes one key with its
own parameters, and the translator writes the whole phrase. Beaver names stay as they are.

### 4. Choosing the language

Auto follows the device language (`navigator.language`): `de*` gives German, anything else English. Settings gets a language choice
(Auto, English, Deutsch) kept like the other choices. Changing it reloads the game after saving, as the
shadows choice does, so no live re-render is needed. Saves hold no text, so they work in any language.
The HUD, buttons and cards are checked for German text length on a phone and a tablet (screenshots per language).

### 5. Static pages

`manual.html` and `privacy.html` get one file per language (`manual.de.html`, `privacy.de.html`), picked by the same setting; English stays the default file. Two copies
is simple, and the manual changes rarely. A check in CI compares the headings of each so a section cannot go missing.

### 6. Fixed names

Almsee, place names and the OpenStreetMap credit stay as they are ([ADR 0003](../decisions/0003-openstreetmap-data-use.md)).
The test menu and dev tools stay English only (`__DEV_TOOLS__` code is not translated).

### 7. Translation quality and review

Machine translation gives the first draft, and the author, a native German speaker, reviews it. Nothing is marked draft in
Settings: once the author has reviewed German, it ships. To make reviewing all text easy there is a review page,
`tools/text-review/` (dev server, like the other preview tools), that lists every key of the tables with English and German
side by side, grouped by file and topic, with the placeholders highlighted and a filter for "not reviewed". The author marks
a key as reviewed there (kept in the browser, exported as a small JSON file `src/i18n/reviewed.de.json` that is committed),
and a count shows how much is left. A key whose English changed after review goes back to "not reviewed" (the file keeps a
hash of the English). The page also shows the static pages (manual, privacy) by heading, and the Play listing text.

### 8. Play listing

`tools/standalone-apk/store/listing.md` gets a German section, and the screenshots are retaken in German
(`MANUAL_SHOTS` style spec with the language set). Play takes them per language in the Console.

## Steps

1. Done: `src/i18n/`, the Settings choice, the test, and the `ui/` strings.
2. Done: the sim text modules, the HUD and toasts, and the review page `tools/text-review/` (English and German side by side,
   edit, tick Reviewed, export `de.ts` and `reviewed.de.json`; a tick holds a hash of the English so it lapses when the English changes).
3. Machine draft of the German tables is in `src/i18n/de.ts` (all keys, du-form, button words as infinitives). The author reviews it on the review page, then `LANGS` gets `de`, the manual and the privacy page in German.
4. Listing text and screenshots in German.

French is a later issue if a reader turns up.
