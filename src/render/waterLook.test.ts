import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ICE_DEPTH, createWaterLook } from './waterLook';
import { seasonLook } from './seasonLook';
import { SWIM_ENTER_DEPTH } from '../sim/state';

describe('createWaterLook', () => {
  it('colours the water for the season', () => {
    const look = createWaterLook();
    const m = new THREE.MeshLambertMaterial();
    look.apply(m);
    const winter = seasonLook(35);
    look.setSeason(winter);
    expect(m.color.getHex()).toBe(new THREE.Color(winter.water).getHex());
  });

  it('adds the ice after the hook a material already has, such as the shadows', () => {
    const look = createWaterLook();
    const m = new THREE.MeshLambertMaterial();
    let shadowHook = false;
    m.onBeforeCompile = () => {
      shadowHook = true;
    };
    look.apply(m);
    const shader = { uniforms: {}, vertexShader: '#include <common>\n#include <begin_vertex>', fragmentShader: '#include <common>\n#include <color_fragment>' };
    m.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer);
    expect(shadowHook).toBe(true);
    expect(shader.vertexShader).toContain('attribute float waterDepth');
    expect(shader.fragmentShader).toContain('iceColor');
    expect(m.customProgramCacheKey()).toContain('ice');
  });

  it('freezes the shallows only in winter, never as deep as the beaver swims', () => {
    const look = createWaterLook();
    const m = new THREE.MeshLambertMaterial();
    look.apply(m);
    const shader = { uniforms: {} as Record<string, { value: unknown }>, vertexShader: '#include <common>\n#include <begin_vertex>', fragmentShader: '#include <common>\n#include <color_fragment>' };
    m.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer);
    look.setSeason(seasonLook(15));
    expect(shader.uniforms.iceDepth!.value).toBe(0);
    look.setSeason(seasonLook(35));
    expect(shader.uniforms.iceDepth!.value).toBe(ICE_DEPTH);
    expect(ICE_DEPTH * 1.35).toBeLessThan(SWIM_ENTER_DEPTH);
  });
});
