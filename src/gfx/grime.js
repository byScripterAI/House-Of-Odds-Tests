import * as THREE from 'three';

/**
 * SUCIEDAD PROCEDURAL.
 *
 * Inyecta en cualquier material estándar/lambert una capa de mugre que se
 * proyecta en el espacio del MUNDO (triplanar), así no depende de las UV y
 * vale para suelos, paredes, muebles y mallas fusionadas. Una variable
 * compartida por zona (`uniform.value` 1 → sucio, 0 → impecable) permite
 * limpiar el casino con una animación continua, sin cambiar materiales.
 *
 * Efecto: oscurece, desatura hacia un marrón polvoriento, endurece el
 * material (menos brillo/metal) y acumula más suciedad cerca del suelo.
 */

const VERT_DECL = 'varying vec3 vGrimeWorld;';
const VERT_BODY = `
  vec4 gw = vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
    gw = instanceMatrix * gw;
  #endif
  vGrimeWorld = ( modelMatrix * gw ).xyz;
`;
const FRAG_DECL = `
  varying vec3 vGrimeWorld;
  uniform float uDirt;
  uniform sampler2D tGrime;
  uniform float uGrimeScale;
  uniform float uGrimeStrength;
`;
const FRAG_BODY = `
  {
    vec3 gN = normalize( inverseTransformDirection( normal, viewMatrix ) );
    vec3 gw3 = pow( abs( gN ), vec3( 4.0 ) );
    gw3 /= ( gw3.x + gw3.y + gw3.z );
    float gm = texture2D( tGrime, vGrimeWorld.zy * uGrimeScale ).r * gw3.x
             + texture2D( tGrime, vGrimeWorld.xz * uGrimeScale ).r * gw3.y
             + texture2D( tGrime, vGrimeWorld.xy * uGrimeScale ).r * gw3.z;
    float low = smoothstep( 2.4, 0.0, vGrimeWorld.y );
    float amt = smoothstep( 0.28, 0.85, gm + low * 0.38 ) * uDirt * uGrimeStrength;
    amt = clamp( amt, 0.0, 1.0 );
    float luma = dot( diffuseColor.rgb, vec3( 0.299, 0.587, 0.114 ) );
    vec3 dusty = vec3( luma ) * vec3( 0.78, 0.68, 0.55 ) * 0.8;
    diffuseColor.rgb = mix( diffuseColor.rgb, dusty, amt * 0.75 );
    #ifdef STANDARD
      roughnessFactor = mix( roughnessFactor, 0.96, amt );
      metalnessFactor *= ( 1.0 - amt * 0.85 );
    #endif
  }
`;

/**
 * @param {THREE.Material} material
 * @param {{uniform:{value:number}, mask:THREE.Texture, scale?:number, strength?:number}} opts
 */
export function grimify(material, { uniform, mask, scale = 0.28, strength = 1 }) {
  if (material.userData.grime) return material;
  material.userData.grime = true;
  const previous = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    previous?.call(material, shader, renderer);
    shader.uniforms.uDirt = uniform;
    shader.uniforms.tGrime = { value: mask };
    shader.uniforms.uGrimeScale = { value: scale };
    shader.uniforms.uGrimeStrength = { value: strength };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_DECL}`)
      .replace('#include <project_vertex>', `#include <project_vertex>\n${VERT_BODY}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_DECL}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${FRAG_BODY}`);
  };
  material.customProgramCacheKey = () => 'grime-v1';
  return material;
}
