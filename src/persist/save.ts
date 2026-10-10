// The saved game (docs/design/26_saving.md). One slot in the browser's storage: the world, plus where the coach was. The world is
// plain data except the ponds' grids, which are typed arrays and go in as base64. No DOM here: the storage comes in as an argument.
import type { Stage } from '../sim/life';
import type { CoachState } from '../ui/coachSteps';
import type { WorldState } from '../sim/state';

/** The key of the one save slot, and where a save that cannot be read is kept, so it is not lost. */
export const SAVE_KEY = 'beaver-cycle.save';
export const SAVE_BACKUP_KEY = 'beaver-cycle.save.unreadable';

/** Bump when the saved shape changes in a way `migrate` must handle. Fields added to `WorldState` need no bump: they take the new game's value. */
export const SAVE_VERSION = 1;

/** Real seconds between saves while playing. A save is a few tens of KB, so this is cheap. */
export const AUTOSAVE_EVERY = 30;

export interface SavedCoach {
  /** False once the player closed the coach for good. */
  on: boolean;
  /** The life stage whose run is up, or was last up. A new stage starts the next run. */
  stage: Stage | null;
  state: CoachState | null;
}

export interface Save {
  version: number;
  /** Wall clock in milliseconds (`Date.now()`), for showing when the game was last played. */
  savedAt: number;
  world: WorldState;
  coach: SavedCoach;
}

/** The part of `Storage` the save needs, so tests can use a plain object. */
export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type Loaded = { kind: 'none' } | { kind: 'ok'; save: Save } | { kind: 'unreadable' };

const TYPED = '__typed';

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromBase64(text: string): Uint8Array {
  const s = atob(text);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

/** Floats and bytes as base64, since JSON would turn a typed array into an object of numbered keys. */
function replacer(_key: string, value: unknown): unknown {
  if (value instanceof Float32Array) return { [TYPED]: 'f32', data: toBase64(new Uint8Array(value.buffer, value.byteOffset, value.byteLength)) };
  if (value instanceof Uint8Array) return { [TYPED]: 'u8', data: toBase64(value) };
  return value;
}

function reviver(_key: string, value: unknown): unknown {
  if (value && typeof value === 'object' && TYPED in value) {
    const { [TYPED]: kind, data } = value as { [TYPED]: string; data: string };
    const bytes = fromBase64(data);
    if (kind === 'f32') return new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    if (kind === 'u8') return bytes;
  }
  return value;
}

/** The world as it is kept: what only matters for the moment (a speed test setting, an open stash screen, a meeting with a predator) is left out. */
export function forSave(world: WorldState): WorldState {
  return { ...world, speedMultiplier: 1, stashOpen: false, predators: [], leader: null, chop: null, drag: null, carry: null, haul: null };
}

export function encodeSave(world: WorldState, coach: SavedCoach, now: number): string {
  const save: Save = { version: SAVE_VERSION, savedAt: now, world: forSave(world), coach };
  return JSON.stringify(save, replacer);
}

/**
 * A save from an older version, brought up to the current shape. There is only version 1 so far: this is where a change that a
 * default cannot cover goes (a renamed field, a changed unit), one step for each version.
 */
export function migrate(save: Save): Save | null {
  if (save.version > SAVE_VERSION) return null;
  return save;
}

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** The save in the text, with the new game's value (`fresh`) for any field it lacks, or null when it is not a save this game can use. */
export function decodeSave(text: string, fresh: WorldState): Save | null {
  let raw: Save;
  try {
    raw = JSON.parse(text, reviver) as Save;
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object' || !isNumber(raw.version) || !raw.world || typeof raw.world !== 'object') return null;
  const moved = migrate(raw);
  if (!moved) return null;
  const w = moved.world;
  const b = w.beaver;
  if (!isNumber(w.clock) || !isNumber(w.bornAt) || !isNumber(w.time) || !b || !isNumber(b.x) || !isNumber(b.z) || !isNumber(b.y)) return null;
  const coach = moved.coach && typeof moved.coach === 'object' ? { on: moved.coach.on === true, stage: moved.coach.stage ?? null, state: moved.coach.state ?? null } : { on: false, stage: null, state: null };
  // The saved fields win. `spots` are the free spots of the tiles at hand, so a save that lacks them gets the game's own.
  return { ...moved, world: { ...fresh, ...w, spots: w.spots ?? fresh.spots }, coach };
}

export function loadSave(storage: SaveStorage, fresh: WorldState): Loaded {
  let text: string | null;
  try {
    text = storage.getItem(SAVE_KEY);
  } catch {
    return { kind: 'none' };
  }
  if (text === null) return { kind: 'none' };
  const save = decodeSave(text, fresh);
  if (save) return { kind: 'ok', save };
  // Keep what could not be read (a newer game's save, or a damaged one) and start clean, rather than lose it.
  try {
    storage.setItem(SAVE_BACKUP_KEY, text);
    storage.removeItem(SAVE_KEY);
  } catch {
    // Left as it is.
  }
  return { kind: 'unreadable' };
}

/** True when written. A full or blocked storage is not an error for the player: the game goes on and tries again next time. */
export function writeSave(storage: SaveStorage, world: WorldState, coach: SavedCoach, now: number): boolean {
  try {
    storage.setItem(SAVE_KEY, encodeSave(world, coach, now));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(storage: SaveStorage): void {
  try {
    storage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear.
  }
}

/**
 * Whether this run loads and writes the save. Not in an automated browser (the tests expect a fresh game) unless ?save=1, and
 * never with a query that sets up a world by hand (?day, ?age, ?stage, ...) or a view without the beaver (?fly): such a run would
 * overwrite the player's game with a test world.
 */
export function wantsSave(query: URLSearchParams, automated: boolean): boolean {
  const asked = query.get('save');
  if (asked === '0') return false;
  if (['day', 'time', 'age', 'stage', 'lodge', 'fly'].some((k) => query.has(k))) return false;
  if (asked === '1') return true;
  return !automated;
}

/** "3 minutes ago", "2 days ago": when the game was last played, for the Continue card. */
export function ago(savedAt: number, now: number): string {
  const minutes = Math.max(0, Math.round((now - savedAt) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} days ago`;
}
