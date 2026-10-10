// The seasonal look of still water, shared by the lake (terrainView.ts) and the beaver's ponds (pondView.ts): the
// season's water colour, and in winter ice in the shallows. The geometry carries the depth of the water over the
// ground at each vertex in a `waterDepth` attribute (0 on the shoreline).
import * as THREE from 'three';
import { SWIM_EXIT_DEPTH } from '../sim/state';
import type { SeasonLook } from './seasonLook';

export const ICE = 0xd6e6ee;
/**
 * In the depth of winter still water freezes where it is shallower than this, in metres: only where the beaver wades,
 * never where it swims (the wavy edge reaches at most a third further), since the sim lets it swim all winter.
 */
export const ICE_DEPTH = SWIM_EXIT_DEPTH;

export interface WaterLook {
  /** Adds the ice to a water material, after any hook it already has (such as the shadows'). */
  apply(material: THREE.Material): void;
  /** Sets the colour and the ice for a season on the materials given to `apply`. */
  setSeason(look: SeasonLook): void;
  /** The ice colour, for water that has no depth to freeze by (the streams). */
  readonly iceColor: THREE.Color;
}

export function createWaterLook(): WaterLook {
  const iceDepth = { value: 0 };
  const iceColor = { value: new THREE.Color(ICE) };
  const materials: THREE.MeshLambertMaterial[] = [];
  return {
    iceColor: iceColor.value,
    apply(material) {
      materials.push(material as THREE.MeshLambertMaterial);
      const previous = material.onBeforeCompile;
      // Where the water is shallower than `iceDepth` it turns to pale, nearly opaque ice, with a wavy edge so it does
      // not just copy the depth lines.
      material.onBeforeCompile = (shader, renderer) => {
        previous.call(material, shader, renderer);
        shader.uniforms.iceDepth = iceDepth;
        shader.uniforms.iceColor = iceColor;
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nattribute float waterDepth;\nvarying float vWaterDepth;\nvarying vec2 vWaterAt;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWaterDepth = waterDepth;\nvWaterAt = position.xz;');
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying float vWaterDepth;\nvarying vec2 vWaterAt;\nuniform float iceDepth;\nuniform vec3 iceColor;')
          .replace(
            '#include <color_fragment>',
            `#include <color_fragment>
            if (iceDepth > 0.0) {
              float wave = sin(vWaterAt.x * 0.21 + 2.0 * sin(vWaterAt.y * 0.13)) * sin(vWaterAt.y * 0.17 + 1.3 + sin(vWaterAt.x * 0.11));
              float frozen = 1.0 - smoothstep(iceDepth * 0.8, iceDepth, vWaterDepth + wave * iceDepth * 0.35);
              diffuseColor.rgb = mix(diffuseColor.rgb, iceColor, frozen);
              diffuseColor.a = mix(diffuseColor.a, 0.95, frozen);
            }`,
          );
      };
      const previousKey = material.customProgramCacheKey.bind(material);
      material.customProgramCacheKey = () => `${previousKey()}|ice`;
    },
    setSeason(look) {
      for (const m of materials) m.color.set(look.water);
      iceDepth.value = look.ice * ICE_DEPTH;
    },
  };
}
