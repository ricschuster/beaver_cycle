// The English words of the game: the source of truth for the keys (docs/design/36_languages.md). Another language is a table
// with the same keys (`de.ts`), and `i18n.test.ts` fails when one is missing. A value is a string with `{name}` placeholders,
// or a list of strings when the game picks one of several. Plain data, no functions, so a translator can read it.
export const en = {
  'ui.close': 'Close',
  'ui.on': 'On',
  'ui.off': 'Off',

  'sound.isOff': 'Sound is off, turn it on',
  'sound.isOn': 'Sound is on, turn it off',

  'settings.title': 'Settings',
  'settings.music': 'Music',
  'settings.sounds': 'Sounds',
  'settings.map': 'Map',
  'settings.shadows': 'Shadows',
  'settings.shadowsNote': 'Shadows look nice but slow some tablets down. Changing them starts the game again, where you left off.',
  'settings.savedGames': 'Saved games',
  'settings.startScreen': 'Start screen',
  'settings.startScreenNote': 'Your game is saved first. Pick another game there, or come back to this one.',
  'settings.language': 'Language',
  'settings.languageNote': 'Changing the language starts the game again, where you left off.',
  'settings.langAuto': 'Automatic',
  'settings.langEn': 'English',
  'settings.langDe': 'Deutsch',

  'map.north': 'North up',
  'map.turn': 'Turning',
  'map.off': 'Off',

  'achievements.title': 'Things I did',
  'achievements.hintIdle': 'Tap one to see how to win it.',
  'achievements.summary': '{won} of {all} won',
  'achievements.tierMark': '{tier} of {tiers} won',
  'achievements.progress': '{have} of {need}',
  'achievements.allDone': 'All done',
} as const;

export type Key = keyof typeof en;
export type Table = Readonly<Record<Key, string | readonly string[]>>;
