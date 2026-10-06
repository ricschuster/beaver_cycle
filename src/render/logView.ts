// Draws the logs of the sim: a brown cylinder each, lying on the ground or on the water. Reads state only.
import * as THREE from 'three';
import { LOG_RADIUS, type Log } from '../sim/logs';

export interface LogView {
  update(logs: readonly Log[]): void;
}

export function createLogView(scene: THREE.Scene, shadows: boolean, prepare: (m: THREE.Material) => void): LogView {
  // A unit long cylinder along +z, so a log's heading turns it about the vertical and its length scales z.
  const geometry = new THREE.CylinderGeometry(LOG_RADIUS, LOG_RADIUS, 1, 8).rotateX(Math.PI / 2);
  const material = new THREE.MeshLambertMaterial({ color: 0x6b4a2b });
  prepare(material);
  const meshes = new Map<string, THREE.Mesh>();
  return {
    update(logs) {
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
      }
      for (const [id, mesh] of meshes) {
        if (seen.has(id)) continue;
        scene.remove(mesh);
        meshes.delete(id);
      }
    },
  };
}
