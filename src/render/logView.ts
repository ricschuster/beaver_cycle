// Draws the logs of the sim: a brown cylinder each, lying on the ground or on the water. Reads state only.
import * as THREE from 'three';
import { LOG_RADIUS, type Log } from '../sim/logs';
import { branchesOf } from '../sim/food';

export interface LogView {
  update(logs: readonly Log[], stripped?: Readonly<Record<string, number>>): void;
}

export function createLogView(scene: THREE.Scene, shadows: boolean, prepare: (m: THREE.Material) => void): LogView {
  // A unit long cylinder along +z, so a log's heading turns it about the vertical and its length scales z.
  const geometry = new THREE.CylinderGeometry(LOG_RADIUS, LOG_RADIUS, 1, 8).rotateX(Math.PI / 2);
  const material = new THREE.MeshLambertMaterial({ color: 0x6b4a2b });
  prepare(material);
  // Where branches were stripped the bark is gone: a pale band that grows along the log from one end.
  const bareMaterial = new THREE.MeshLambertMaterial({ color: 0xd8b98a });
  prepare(bareMaterial);
  const bands = new Map<string, THREE.Mesh>();
  const meshes = new Map<string, THREE.Mesh>();
  return {
    update(logs, stripped = {}) {
      const seen = new Set<string>();
      for (const log of logs) {
        seen.add(log.id);
        let mesh = meshes.get(log.id);
        if (!mesh) {
          mesh = new THREE.Mesh(geometry, material);
          mesh.castShadow = shadows;
          meshes.set(log.id, mesh);
          scene.add(mesh);
        }
        mesh.position.set(log.x, log.y, log.z);
        mesh.rotation.y = log.heading;
        mesh.scale.set(1, 1, log.length);
        let band = bands.get(log.id);
        if (!band) {
          band = new THREE.Mesh(geometry, bareMaterial);
          bands.set(log.id, band);
          mesh.add(band);
        }
        const bare = Math.min(1, (stripped[log.id] ?? 0) / Math.max(1, branchesOf(log)));
        band.visible = bare > 0;
        // A child of the scaled log: z is in log lengths, so the band spans `bare` of it from the -z end.
        band.scale.set(1.04, 1.04, bare);
        band.position.z = -0.5 + bare / 2;
      }
      for (const [id, mesh] of meshes) {
        if (seen.has(id)) continue;
        scene.remove(mesh);
        meshes.delete(id);
        bands.delete(id);
      }
    },
  };
}
