// Game clock: day and night, and four seasons of ten days (docs/design/09_game_length_and_speed.md).
// Pure functions of the clock value, so the renderer and the HUD can read the same time.

/** Real seconds in one game day. 8 minutes after the author asked to double the proposed 4; still to tune by playing (#114). */
export const DAY_SECONDS = 480;
export const DAYS_PER_SEASON = 10;
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type Season = (typeof SEASONS)[number];
export const DAYS_PER_YEAR = DAYS_PER_SEASON * SEASONS.length;
/** The day starts at dawn, and the light lasts this part of it (5 of 8 minutes); the rest is night. */
export const DAY_FRACTION = 0.625;
/** The lodge clock runs at this share of the outside rate (decided by the author). */
export const LODGE_CLOCK_RATE = 0.5;
/** Where a new game starts: a little after dawn. */
export const START_CLOCK = DAY_SECONDS * 0.05;

export interface GameDate {
  /** Whole days since the start, from 0. */
  day: number;
  /** Day within the year, 0 to 39. */
  dayOfYear: number;
  /** Day within the season, 1 to 10, for showing. */
  dayOfSeason: number;
  season: Season;
  /** Whole years since the start, from 0. */
  year: number;
  /** Part of the day gone since dawn, 0 up to but not including 1. */
  timeOfDay: number;
}

export function dateAt(clock: number): GameDate {
  const days = Math.max(0, clock) / DAY_SECONDS;
  const day = Math.floor(days);
  const dayOfYear = day % DAYS_PER_YEAR;
  return {
    day,
    dayOfYear,
    dayOfSeason: (dayOfYear % DAYS_PER_SEASON) + 1,
    season: SEASONS[Math.floor(dayOfYear / DAYS_PER_SEASON)]!,
    year: Math.floor(day / DAYS_PER_YEAR),
    timeOfDay: days - day,
  };
}

export function isNight(clock: number): boolean {
  return dateAt(clock).timeOfDay >= DAY_FRACTION;
}

/** Ramp length at dawn and dusk, as a part of the day. */
const TWILIGHT = 0.05;

/** How bright it is, 0 at night to 1 at midday, with a short ramp at dawn and dusk. */
export function daylight(timeOfDay: number): number {
  const t = Math.min(1, Math.max(0, timeOfDay));
  const up = Math.min(1, t / TWILIGHT);
  const down = Math.min(1, (DAY_FRACTION + TWILIGHT - t) / (2 * TWILIGHT));
  const x = Math.max(0, Math.min(up, down));
  return x * x * (3 - 2 * x);
}

/** The clock value of the next dawn after this one. */
export function nextDawn(clock: number): number {
  return (dateAt(clock).day + 1) * DAY_SECONDS;
}

/** The clock value of the dawn that starts the next season. */
export function nextSeasonStart(clock: number): number {
  const d = dateAt(clock);
  return (d.day - (d.dayOfYear % DAYS_PER_SEASON) + DAYS_PER_SEASON) * DAY_SECONDS;
}

/** The clock value of the dawn of the first day of spring after this clock value (a year starts with spring). */
export function nextSpringStart(clock: number): number {
  return (dateAt(clock).year + 1) * DAYS_PER_YEAR * DAY_SECONDS;
}

/** The same day with the clock moved to this part of the day (0 dawn up to 1). Used by the test menu. */
export function withTimeOfDay(clock: number, timeOfDay: number): number {
  return (dateAt(clock).day + Math.min(0.999, Math.max(0, timeOfDay))) * DAY_SECONDS;
}

/** The first day of this season in the same year, keeping the part of the day. Used by the test menu. */
export function withSeason(clock: number, season: Season): number {
  const d = dateAt(clock);
  const day = d.year * DAYS_PER_YEAR + SEASONS.indexOf(season) * DAYS_PER_SEASON;
  return (day + d.timeOfDay) * DAY_SECONDS;
}
