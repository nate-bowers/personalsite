"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Conditions } from "@/lib/ndbc";
import { oceanParams } from "@/lib/ocean-map";
import { gerstnerGlsl } from "@/lib/gerstner";
import type { OpennessField } from "@/lib/openness";
import { TOKENS, HEIGHT_FOG_GLSL } from "./atmosphere";

/**
 * Gerstner-displaced water plane. Amplitude / speed / chop come from the live
 * buoy via the shared oceanParams() mapping; the wave maths is GENERATED from
 * lib/gerstner.ts so the CPU twin (buoys, ferry) rides the identical surface.
 * Per-vertex `aOpen` (real bathymetry + swell shelter) keeps the bay calm and
 * shoals the swell at the coast. Two-tone shading per the locked golden-hour
 * tokens, elongated sun-glitter path, shared exponential height fog.
 *
 * Displacement fades out past DISP_FAR so the far water is a flat silhouette —
 * this (plus a sky dome that fully encloses the plane) is what killed the
 * wavy banding that used to bleed into the sky.
 */

const SIZE = 320; // plane size — fully inside the 500-radius sky dome
const SEGS = 220; // ~80k tris; fragment ripples carry the fine detail
const DISP_FAR = 30; // world units beyond which Gerstner displacement is gone

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uAmp;
  uniform float uSpeed;
  uniform float uChop;
  uniform vec3 uCamPos;
  attribute float aOpen;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vOpen;

  void main() {
    vec2 p = position.xy; // plane-local: p.x = world x, p.y = -world z

    // amplitude = live conditions * local exposure, faded with camera distance
    float distFade = 1.0 - smoothstep(${(DISP_FAR * 0.55).toFixed(1)}, ${DISP_FAR.toFixed(1)}, distance(uCamPos.xz, vec2(p.x, -p.y)));
    float A0 = uAmp * aOpen * distFade;

    float height = 0.0;
    vec2 horiz = vec2(0.0);
    vec3 nrm = vec3(0.0, 0.0, 1.0);
    ${gerstnerGlsl}

    vec3 displaced = vec3(p + horiz, height);
    vec4 world = modelMatrix * vec4(displaced, 1.0);
    vWorldPos = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * normalize(nrm));
    vOpen = aOpen;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uNear;
  uniform vec3 uFar;
  uniform vec3 uGlitter;
  uniform vec3 uSunDir;
  uniform float uChop;
  uniform float uTime;
  uniform vec3 uSkyHigh;
  uniform vec3 uSkyLow;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vOpen;

  ${HEIGHT_FOG_GLSL}

  void main() {
    // moving ripple detail (shading only), faded where the water is sheltered
    float ripple = vOpen * 0.8 + 0.2;
    vec2 q = vWorldPos.xz;
    float rx = (cos(q.x * 2.6 + uTime * 1.3) * 0.12 + cos(q.x * 6.1 - q.y * 1.4 + uTime * 2.1) * 0.07) * ripple;
    float rz = (sin(q.y * 2.4 - uTime * 1.05) * 0.12 + sin(q.y * 6.4 + q.x * 1.1 - uTime * 1.8) * 0.07) * ripple;
    vec3 N = normalize(vNormal + vec3(rx, 0.0, rz));
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 S = normalize(uSunDir);
    vec3 R = reflect(-V, N);

    // two-tone water per tokens: near deep blue -> far violet
    float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    vec3 base = mix(uNear, uFar, clamp(fres * 0.6, 0.0, 1.0));

    // cheap sky reflection at grazing angles
    vec3 sky = mix(uSkyLow, uSkyHigh, clamp(R.y * 0.5 + 0.3, 0.0, 1.0));
    float reflAmt = pow(1.0 - max(dot(N, V), 0.0), 4.0);
    vec3 color = mix(base, sky, reflAmt * 0.18);

    // sun glitter — elongated golden path on the LIVE waves only. Past the
    // displacement fade the sea is mirror-flat and a mirror turns the sun into
    // a razor-thin vertical line (the "spike"), so glitter dies with the waves.
    float glint = pow(max(dot(R, S), 0.0), 34.0);
    float glow = pow(max(dot(R, S), 0.0), 14.0);
    float pathFade = 1.0 - smoothstep(10.0, 26.0, length(cameraPosition - vWorldPos));
    color += uGlitter * (glint * 1.2 + glow * 0.25) * pathFade;

    float dist = length(cameraPosition - vWorldPos);
    color = applyHeightFog(color, dist, vWorldPos.y);

    gl_FragColor = vec4(color, 1.0);
  }
`;

const farVertexShader = /* glsl */ `
  varying vec3 vWorldPos;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPos = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const farFragmentShader = /* glsl */ `
  uniform vec3 uFar;
  varying vec3 vWorldPos;
  ${HEIGHT_FOG_GLSL}
  void main() {
    float dist = length(cameraPosition - vWorldPos);
    gl_FragColor = vec4(applyHeightFog(uFar, dist, 0.0), 1.0);
  }
`;

/** Flat fog-toned sea carrying the waterline out past the sky dome wall, so
 * the Gerstner plane's corners never show against the sky. */
function FarWater() {
  const uniforms = useMemo(
    () => ({ uFar: { value: new THREE.Color(TOKENS.waterFar) } }),
    [],
  );
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
      <ringGeometry args={[140, 1200, 48, 1]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={farVertexShader}
        fragmentShader={farFragmentShader}
      />
    </mesh>
  );
}

export default function Water({
  conditions,
  sunDir,
  openness,
}: {
  conditions: Conditions;
  sunDir: [number, number, number];
  openness: OpennessField;
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const params = oceanParams(conditions);

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEGS, SEGS);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const open = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      // plane-local -> world: (px, py) -> (x, -z)
      open[i] = openness.sample(pos.getX(i), -pos.getY(i));
    }
    geo.setAttribute("aOpen", new THREE.BufferAttribute(open, 1));
    return geo;
  }, [openness]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAmp: { value: params.ampScale },
      uSpeed: { value: params.speed },
      uChop: { value: params.windChop },
      uCamPos: { value: new THREE.Vector3() },
      uNear: { value: new THREE.Color(TOKENS.waterNear) },
      uFar: { value: new THREE.Color(TOKENS.waterFar) },
      uGlitter: { value: new THREE.Color(TOKENS.glitter) },
      uSunDir: { value: new THREE.Vector3(...sunDir) },
      uSkyHigh: { value: new THREE.Color(TOKENS.skyZenith) },
      uSkyLow: { value: new THREE.Color(TOKENS.skyLow) },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // keep conditions-driven uniforms current without recreating the material
  uniforms.uAmp.value = params.ampScale;
  uniforms.uSpeed.value = params.speed;
  uniforms.uChop.value = params.windChop;

  useFrame((state, delta) => {
    if (matRef.current) {
      (matRef.current.uniforms.uTime.value as number) += delta;
      (matRef.current.uniforms.uCamPos.value as THREE.Vector3).copy(state.camera.position);
    }
  });

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} geometry={geometry}>
        <shaderMaterial
          ref={matRef}
          uniforms={uniforms}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
        />
      </mesh>
      <FarWater />
    </group>
  );
}
