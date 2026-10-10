// The six play locations on the real tiles (#42): can a lodge be built, do animals and other families turn up? The tiles are built
// locally and not in git, so this skips without them (as CI does). It reads the tile files straight from public/tiles/.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AnimalField } from '../sim/animals';
import { firstSpots, type DamSpot } from '../sim/damSpots';
import { findSite } from '../sim/lodge';
import { growNeighbours, type Neighbour } from '../sim/neighbours';
import { LODGE_POND_CREST, floodPond, withPonds } from '../sim/pond';
import type { ScannedSite } from '../sim/damSpots';
import { decodeTile, type TileIndex, type TileWater } from './format';
import { TileStore } from './store';

const DIR = new URL('../../public/tiles/', import.meta.url).pathname;
const HAVE_TILES = existsSync(`${DIR}index.json`) && existsSync(`${DIR}dam_sites.json`);

const LOCATIONS = ['core', 'north', 'south', 'east-oedseen', 'vorderer-springbach', 'hinterer-springbach'];

function load(): { store: TileStore; sites: ScannedSite[]; anchors: Map<string, { x: number; z: number }> } {
  const index = JSON.parse(readFileSync(`${DIR}index.json`, 'utf8')) as TileIndex;
  const store = new TileStore(index);
  for (const t of index.tiles) {
    if (t.far) continue;
    for (const level of [0, 3]) {
      const file = `${DIR}L${level}/${t.tx}_${t.tz}.bin`;
      if (!existsSync(file)) continue;
      const b = readFileSync(file);
      store.put(decodeTile(t.tx, t.tz, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer));
    }
    const water = `${DIR}water/${t.tx}_${t.tz}.json`;
    if (existsSync(water)) store.putWater(t.tx, t.tz, JSON.parse(readFileSync(water, 'utf8')) as TileWater);
  }
  const sites = (JSON.parse(readFileSync(`${DIR}dam_sites.json`, 'utf8')) as { sites: ScannedSite[] }).sites;
  const anchors = new Map(index.anchors.filter((a) => a.kind === 'location').map((a) => [a.id, { x: a.x, z: a.z }]));
  return { store, sites, anchors };
}

describe.skipIf(!HAVE_TILES)('the play locations on the real tiles', () => {
  const { store, sites, anchors } = HAVE_TILES ? load() : ({} as ReturnType<typeof load>);

  it('has all six locations', () => {
    expect([...anchors.keys()].sort()).toEqual([...LOCATIONS].sort());
  });

  for (const id of LOCATIONS) {
    const anchor = (): { x: number; z: number } => anchors.get(id)!;

    it(`${id}: first dam spots exist and a level 2 pond at one has room for a lodge`, () => {
      const spots = firstSpots(sites, id, anchor());
      expect(spots.length).toBeGreaterThanOrEqual(3);
      const holding: DamSpot[] = [];
      for (const spot of spots) {
        const pond = floodPond(store, spot, LODGE_POND_CREST);
        if (!pond) continue;
        const lodge = findSite(withPonds(store, [pond]), spot.bed.x, spot.bed.z, 100);
        if (lodge) holding.push(spot);
      }
      console.log(id, 'spots', spots.length, 'lodge ponds', holding.length);
      expect(holding.length).toBeGreaterThanOrEqual(1);
    });

    it(`${id}: animals live round the anchor`, () => {
      const field = new AnimalField();
      const a = anchor();
      // Several cells wide, at noon, so the count does not hang on one hash. Some valleys show a single kind (hinterer-springbach: fox).
      const kinds = new Set<string>();
      for (const [dx, dz] of [[0, 0], [300, 0], [-300, 0], [0, 300], [0, -300]]) {
        for (const animal of field.near(store, a.x + dx!, a.z + dz!, 0.3 * 600, 40, 200)) kinds.add(animal.kind);
      }
      console.log(id, 'animal kinds', [...kinds].sort().join(','));
      expect(kinds.size).toBeGreaterThanOrEqual(1);
    });

    it(`${id}: other families are found along the water`, () => {
      const a = anchor();
      const home = { x: a.x + 1, z: a.z + 1 };
      const tried = new Set<string>();
      let families: readonly Neighbour[] = [];
      // Walk a cross of 1.5 km through the anchor, a step at a time, as a player would.
      for (let d = -1500; d <= 1500; d += 100) {
        families = growNeighbours(families, store, { x: a.x + d, z: a.z }, home, tried);
        families = growNeighbours(families, store, { x: a.x, z: a.z + d }, home, tried);
      }
      console.log(id, 'families', families.length);
      expect(families.length).toBeGreaterThanOrEqual(1);
    });
  }
});
