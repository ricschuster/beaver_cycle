// The saved game (docs/design/26_saving.md). Four slots in the browser's storage: the world, plus where the coach was. The world is
// plain data except the ponds' grids, which are typed arrays and go in as base64. No DOM here: the storage comes in as an argument.
import { t } from '../i18n';
import type { Stage } from '../sim/life';
import type { CoachState } from '../ui/coachSteps';
import type { WorldState } from '../sim/state';

/** The key of the first save slot (the one save of the games before slots), and where a save that cannot be read is kept, so it is not lost. */
export const SAVE_KEY = 'beaver-cycle.save';
export const SAVE_BACKUP_KEY = 'beaver-cycle.save.unreadable';

export const SLOT_COUNT = 4;
/** The longest name a slot may have. */
export const NAME_MAX = 24;

/** The key of slot 1 to 4. Slot 1 keeps the old key, so a save made before the slots is slot 1 as it is. */
export function slotKey(slot: number): string {
  return slot <= 1 ? SAVE_KEY : `${SAVE_KEY}.${slot}`;
}

export function backupKey(slot: number): string {
  return `${slotKey(slot)}.unreadable`;
}

/** A slot number from the address or the saved choice, 1 to `SLOT_COUNT`, or null. */
export function parseSlot(text: string | null): number | null {
  const n = Number(text);
  return text !== null && Number.isInteger(n) && n >= 1 && n <= SLOT_COUNT ? n : null;
}

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
  /** What the player called this game. Added with the slots: an older save has none, which is fine. */
  name?: string;
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
  return { ...world, speedMultiplier: 1, stashOpen: false, predators: [], leader: null, escort: null, pairWith: null, chop: null, drag: null, carry: null, haul: null };
}

export function encodeSave(world: WorldState, coach: SavedCoach, now: number, name = ''): string {
  const save: Save = { version: SAVE_VERSION, savedAt: now, world: forSave(world), coach };
  if (name) save.name = name;
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
  const name = typeof moved.name === 'string' ? cleanName(moved.name) : undefined;
  return { ...moved, name, world: { ...fresh, ...w, spots: w.spots ?? fresh.spots }, coach };
}

export function loadSave(storage: SaveStorage, fresh: WorldState, slot = 1): Loaded {
  let text: string | null;
  try {
    text = storage.getItem(slotKey(slot));
  } catch {
    return { kind: 'none' };
  }
  if (text === null) return { kind: 'none' };
  const save = decodeSave(text, fresh);
  if (save) return { kind: 'ok', save };
  // Keep what could not be read (a newer game's save, or a damaged one) and start clean, rather than lose it.
  try {
    storage.setItem(backupKey(slot), text);
    storage.removeItem(slotKey(slot));
  } catch {
    // Left as it is.
  }
  return { kind: 'unreadable' };
}

/** True when written. A full or blocked storage is not an error for the player: the game goes on and tries again next time. */
export function writeSave(storage: SaveStorage, world: WorldState, coach: SavedCoach, now: number, slot = 1, name = ''): boolean {
  try {
    storage.setItem(slotKey(slot), encodeSave(world, coach, now, name));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(storage: SaveStorage, slot = 1): void {
  try {
    storage.removeItem(slotKey(slot));
  } catch {
    // Nothing to clear.
  }
}

/** A name the player typed, trimmed to one line of at most `NAME_MAX` characters. */
export function cleanName(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
}

/** Gives a saved game a new name without touching the rest of it. False when the slot holds nothing that can be renamed. */
export function renameSave(storage: SaveStorage, slot: number, name: string): boolean {
  try {
    const text = storage.getItem(slotKey(slot));
    if (text === null) return false;
    const raw = JSON.parse(text) as Record<string, unknown>;
    const clean = cleanName(name);
    if (clean) raw.name = clean;
    else delete raw.name;
    storage.setItem(slotKey(slot), JSON.stringify(raw));
    return true;
  } catch {
    return false;
  }
}

/** What a slot card shows. `world` is only read for the life stage and generation, so a slot is a few fields, not a game. */
export type SlotInfo = { slot: number; kind: 'empty' } | { slot: number; kind: 'unreadable' } | { slot: number; kind: 'used'; name: string; savedAt: number; clock: number; bornAt: number; generation: number };

/** The four slots, for the start screen. A slot that cannot be read is kept under its backup key by `loadSave`, as at a start. */
export function readSlots(storage: SaveStorage, fresh: WorldState): SlotInfo[] {
  return Array.from({ length: SLOT_COUNT }, (_, i) => {
    const slot = i + 1;
    const found = loadSave(storage, fresh, slot);
    if (found.kind === 'none') return { slot, kind: 'empty' as const };
    if (found.kind === 'unreadable') return { slot, kind: 'unreadable' as const };
    const { savedAt, name, world } = found.save;
    return { slot, kind: 'used' as const, name: name ?? '', savedAt, clock: world.clock, bornAt: world.bornAt, generation: world.generation };
  });
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
  if (minutes < 1) return t('ago.now');
  if (minutes < 60) return t(minutes === 1 ? 'ago.minute' : 'ago.minutes', { n: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 48) return t(hours === 1 ? 'ago.hour' : 'ago.hours', { n: hours });
  const days = Math.round(hours / 24);
  return t('ago.days', { n: days });
}
