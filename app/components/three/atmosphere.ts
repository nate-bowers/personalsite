import * as THREE from "three";

/**
 * One atmosphere for every material in the scene (DESIGN-PHASE2.md §1):
 * exponential HEIGHT fog in the --fog token color — low terrain and the sea
 * dissolve into haze with distance while peaks hold out longer, which is what
 * stacks the ridgelines into 3-4 visible depth layers. A hard distance ramp
 * (FAR0..FAR1) guarantees that nothing — terrain edge, water edge — is ever
 * visible against the sky regardless of camera.
 *
 * Custom ShaderMaterials (terrain, water) inline HEIGHT_FOG_GLSL; standard
 * materials (trees, buoys, bridge, ferry, clouds) get the same formula patched
 * over three's built-in fog chunks via installHeightFog(). Both paths share the
 * constants below, so the fog is exactly consistent across the frame.
 */

// Golden-hour tokens (globals.css / DESIGN-PHASE2.md §1).
export const TOKENS = {
  skyZenith: "#4A3D6B",
  skyLow: "#E8895A",
  sunGlow: "#FFD9A0",
  waterFar: "#2E2A4F",
  waterNear: "#1E3A52",
  glitter: "#FFB870",
  landLit: "#C97B4A",
  landShade: "#3D3357",
  fog: "#D9A084",
  accent: "#FF7847",
} as const;

export const FOG = {
  DENSITY: 0.015, // exponential density at sea level
  FALLOFF: 1.0, // how fast fog thins with altitude (scene units)
  FAR0: 30, // hard ramp start — beyond this everything fades…
  FAR1: 46, // …and is fully fog by here (terrain/water edges live past 50)
} as const;

const c = (hex: string) => new THREE.Color(hex);
const v3 = (col: THREE.Color) =>
  `vec3(${col.r.toFixed(4)}, ${col.g.toFixed(4)}, ${col.b.toFixed(4)})`;

/** Shared GLSL — identical maths for custom shaders and patched built-ins.
 * The blend happens in gamma space: mixing a bright warm fog over dark water
 * in linear light lets the fog's energy swamp the base at tiny mix amounts,
 * which is what washed the whole sea pink. Perceptual mixing keeps 15% fog
 * looking like 15% fog. */
export const HEIGHT_FOG_GLSL = /* glsl */ `
  vec3 applyHeightFog(vec3 col, float viewDist, float worldY) {
    float hf = 1.0 - exp(-${FOG.DENSITY.toFixed(4)} * viewDist * exp(-${FOG.FALLOFF.toFixed(4)} * max(worldY, 0.0)));
    float df = smoothstep(${FOG.FAR0.toFixed(1)}, ${FOG.FAR1.toFixed(1)}, viewDist);
    float amt = clamp(hf + df, 0.0, 1.0);
    // fog warms toward the horizon band so far terrain dissolves into the sky
    vec3 fogCol = mix(${v3(c(TOKENS.fog))}, ${v3(c(TOKENS.skyLow))}, df);
    vec3 a = pow(max(col, 0.0), vec3(0.4545));
    vec3 b = pow(fogCol, vec3(0.4545));
    return pow(mix(a, b, amt), vec3(2.2));
  }
`;

let installed = false;

/**
 * Replace three's exp2 fog chunks with the shared height-fog formula. The scene
 * still sets <fogExp2> so standard materials compile with USE_FOG; the chunk
 * override below is what actually runs. Idempotent.
 */
export function installHeightFog() {
  if (installed) return;
  installed = true;

  THREE.ShaderChunk.fog_pars_vertex = /* glsl */ `
    #ifdef USE_FOG
      varying float vFogDepth;
      varying float vFogWorldY;
      varying vec3 vFogWorldPos;
    #endif
  `;
  THREE.ShaderChunk.fog_vertex = /* glsl */ `
    #ifdef USE_FOG
      vFogDepth = - mvPosition.z;
      vec4 hfWorld = vec4( transformed, 1.0 );
      #ifdef USE_INSTANCING
        hfWorld = instanceMatrix * hfWorld;
      #endif
      hfWorld = modelMatrix * hfWorld;
      vFogWorldY = hfWorld.y;
      vFogWorldPos = hfWorld.xyz;
    #endif
  `;
  THREE.ShaderChunk.fog_pars_fragment = /* glsl */ `
    #ifdef USE_FOG
      varying float vFogDepth;
      varying float vFogWorldY;
      varying vec3 vFogWorldPos;
      uniform vec3 fogColor;
      #ifdef FOG_EXP2
        uniform float fogDensity;
      #else
        uniform float fogNear;
        uniform float fogFar;
      #endif
      ${HEIGHT_FOG_GLSL}
    #endif
  `;
  THREE.ShaderChunk.fog_fragment = /* glsl */ `
    #ifdef USE_FOG
      // Fog by TRUE camera distance, matching the terrain/water shaders (which
      // use length(cameraPosition - worldPos)). View-space depth (vFogDepth)
      // under-fogged anything off the view axis, so props toward the frame edges
      // — the trees especially — stayed crisp while the ridgelines right behind
      // them washed out. One distance metric for every material now.
      float hfDist = length(vFogWorldPos - cameraPosition);
      gl_FragColor.rgb = applyHeightFog(gl_FragColor.rgb, hfDist, vFogWorldY);
      // Distance sun-halo: backlit standard-material props (trees, buoys, ferry,
      // ship, whale, landmarks) must dissolve into the SAME warm haze the
      // terrain/water shaders add by hand — otherwise the trees stay crisp and
      // dark while the ridges behind them glow, and they "don't fade".
      {
        float hfDf = smoothstep(${FOG.FAR0.toFixed(1)}, ${FOG.FAR1.toFixed(1)}, hfDist);
        vec3 hfV = normalize(vFogWorldPos - cameraPosition);
        vec3 hfS = vec3(0.3693, 0.0499, -0.9280); // normalized SUN_DIR
        gl_FragColor.rgb += ${v3(c(TOKENS.sunGlow))} * pow(max(dot(hfV, hfS), 0.0), 18.0) * 0.7 * hfDf;
      }
    #endif
  `;
}
