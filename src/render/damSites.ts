// Debug view of the dam site scan (tools/dam-sites/scan_dam_sites.py): a tall pole at each candidate site, coloured by
// pond size, and a bar across the stream where the dam would stand. Toggled in the test menu. Reads data only.
import * as THREE from 'three';

/** One site as the scan writes it to dam_sites.json. */
export interface DamSite {
  stream: string;
  x: number;
  z: number;
  bed_m: number;
  /** Unit vector pointing downstream, in x and z. */
  flow: [number, number];
  crest_m: number;
  left_m: number;
  right_m: number;
  pond_m2: number;
}

/** Pole colours by pond size: small, medium, large. */
const SMALL = 600;
const LARGE = 1500;
const COLOURS = [0xffe14a, 0xff9a2e, 0xff3b3b];
const POLE_HEIGHT = 30;

/** Where the dam bar goes for a site: its middle, length and the angle about the vertical axis. */
export function damBar(site: DamSite): { x: number; z: number; length: number; yaw: number } {
  // Across the stream is the flow turned a quarter: left is on the +across side, right on the other.
  const ax = -site.flow[1];
  const az = site.flow[0];
  const shift = (site.left_m - site.right_m) / 2;
  return { x: site.x + ax * shift, z: site.z + az * shift, length: site.left_m + site.right_m, yaw: Math.atan2(-az, ax) };
}

export function pondColour(pondM2: number): number {
  return COLOURS[pondM2 < SMALL ? 0 : pondM2 < LARGE ? 1 : 2]!;
}

/** Adds the markers to the scene, standing on each site's own bed height, so far sites need no loaded tile. */
export function createDamSiteView(scene: THREE.Scene, sites: DamSite[]): THREE.Group {
  const group = new THREE.Group();
  const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 0.35, POLE_HEIGHT, 6), new THREE.MeshBasicMaterial(), sites.length);
  const bars = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.8, 0.8), new THREE.MeshBasicMaterial({ color: 0xffffff }), sites.length);
  const m = new THREE.Matrix4();
  sites.forEach((s, i) => {
    const y = s.bed_m;
    poles.setMatrixAt(i, m.makeTranslation(s.x, y + POLE_HEIGHT / 2 - 1, s.z));
    poles.setColorAt(i, new THREE.Color(pondColour(s.pond_m2)));
    const bar = damBar(s);
    m.compose(new THREE.Vector3(bar.x, y + s.crest_m, bar.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), bar.yaw), new THREE.Vector3(bar.length, 1, 1));
    bars.setMatrixAt(i, m);
  });
  poles.frustumCulled = false;
  bars.frustumCulled = false;
  group.add(poles, bars);
  scene.add(group);
  return group;
}

/** Fetches the scan result from the tile folder. Resolves to an empty list when the file is not there. */
export async function loadDamSites(base: string): Promise<DamSite[]> {
  try {
    const res = await fetch(`${base}dam_sites.json`);
    if (!res.ok) return [];
    return ((await res.json()) as { sites: DamSite[] }).sites;
  } catch {
    return [];
  }
}
