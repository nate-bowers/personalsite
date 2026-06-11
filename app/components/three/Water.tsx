"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Conditions } from "@/lib/ndbc";
import { oceanParams } from "@/lib/ocean-map";

/**
 * Gerstner-displaced water plane. Amplitude / speed / chop come from the live buoy
 * via the shared oceanParams() mapping (identical to the 2D ocean). Two-tone shading
 * (near/far water tokens) plus an elongated sun-glitter specular toward the western
 * sun. Manual exponential fog matches the terrain haze. See DESIGN-PHASE2.md §4.
 */

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uAmp;
  uniform float uSpeed;
  uniform float uChop;
  uniform float uCoastX;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vHeight;
  varying float vAmp;

  const float PI = 3.14159265359;

  void main() {
    vec2 p = position.xy;       // horizontal plane coords (pre-rotation); p.x = world x

    // Swell lives on the open Pacific (west, small x) and calms toward the coast and
    // the bay (east, larger x), so waves roll into the shore instead of filling the bay.
    float coastAmp = 1.0 - smoothstep(uCoastX - 2.5, uCoastX + 1.0, p.x);
    vAmp = coastAmp;
    float A = uAmp * coastAmp;

    float height = 0.0;
    vec2 horiz = vec2(0.0);
    vec3 nrm = vec3(0.0, 0.0, 1.0);

    // Three Gerstner swells rolling toward the shore (north-east, toward the land).
    vec2 d1 = normalize(vec2(1.0, 1.0));
    float k1 = 2.0 * PI / 9.0;
    float a1 = 0.11 * A;
    float ph1 = k1 * dot(d1, p) + uTime * 1.3 * uSpeed;
    float c1 = cos(ph1);
    float s1 = sin(ph1);
    horiz += 0.6 * a1 * d1 * c1;
    height += a1 * s1;
    nrm.x -= d1.x * k1 * a1 * c1;
    nrm.y -= d1.y * k1 * a1 * c1;
    nrm.z -= 0.6 * k1 * a1 * s1;

    vec2 d2 = normalize(vec2(1.0, 0.6));
    float k2 = 2.0 * PI / 5.0;
    float a2 = 0.06 * A;
    float ph2 = k2 * dot(d2, p) + uTime * 1.7 * uSpeed;
    float c2 = cos(ph2);
    float s2 = sin(ph2);
    horiz += 0.7 * a2 * d2 * c2;
    height += a2 * s2;
    nrm.x -= d2.x * k2 * a2 * c2;
    nrm.y -= d2.y * k2 * a2 * c2;
    nrm.z -= 0.7 * k2 * a2 * s2;

    vec2 d3 = normalize(vec2(0.6, 1.0));
    float k3 = 2.0 * PI / 2.6;
    float a3 = 0.035 * (0.5 + uChop) * A;
    float ph3 = k3 * dot(d3, p) + uTime * 2.2 * uSpeed;
    float c3 = cos(ph3);
    float s3 = sin(ph3);
    horiz += 0.8 * a3 * d3 * c3;
    height += a3 * s3;
    nrm.x -= d3.x * k3 * a3 * c3;
    nrm.y -= d3.y * k3 * a3 * c3;
    nrm.z -= 0.8 * k3 * a3 * s3;

    vec3 displaced = vec3(p + horiz, height);
    vHeight = height;
    vec4 world = modelMatrix * vec4(displaced, 1.0);
    vWorldPos = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * normalize(nrm));
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uNear;
  uniform vec3 uFar;
  uniform vec3 uGlitter;
  uniform vec3 uSunDir;
  uniform vec3 uFog;
  uniform float uFogDensity;
  uniform float uChop;
  uniform float uTime;
  uniform vec3 uSkyHigh;
  uniform vec3 uSkyLow;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vHeight;
  varying float vAmp;

  void main() {
    // moving ripple detail (shading only), faded toward the calm bay/inland
    float ripple = vAmp * 0.85 + 0.15;
    vec2 q = vWorldPos.xz;
    float rx = (cos(q.x * 2.6 + uTime * 1.3) * 0.13 + cos(q.x * 5.9 - q.y * 1.4 + uTime * 2.1) * 0.07) * ripple;
    float rz = (sin(q.y * 2.4 - uTime * 1.05) * 0.13 + sin(q.y * 6.2 + q.x * 1.1 - uTime * 1.8) * 0.07) * ripple;
    vec3 N = normalize(vNormal + vec3(rx, 0.0, rz));
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 S = normalize(uSunDir);
    vec3 R = reflect(-V, N);

    // two-tone base
    float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    vec3 base = mix(uNear, uFar, clamp(fres * 1.2, 0.0, 1.0));
    base += uGlitter * 0.04 * max(dot(N, S), 0.0);

    // cheap sky reflection (stronger at grazing angles)
    vec3 sky = mix(uSkyLow, uSkyHigh, clamp(R.y * 0.5 + 0.3, 0.0, 1.0));
    float reflAmt = pow(1.0 - max(dot(N, V), 0.0), 4.0);
    vec3 color = mix(base, sky, reflAmt * 0.5);

    // sun glitter — a soft, elongated golden path toward the low sun (no hard dots)
    float glint = pow(max(dot(R, S), 0.0), 42.0);
    float glow = pow(max(dot(R, S), 0.0), 8.0);
    color += uGlitter * (glint * 1.1 + glow * 0.5);

    // exponential distance fog
    float dist = length(cameraPosition - vWorldPos);
    float fog = 1.0 - exp(-uFogDensity * dist);
    color = mix(color, uFog, clamp(fog, 0.0, 1.0));

    gl_FragColor = vec4(color, 1.0);
  }
`;

export default function Water({
  conditions,
  sunDir,
}: {
  conditions: Conditions;
  sunDir: [number, number, number];
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const params = oceanParams(conditions);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAmp: { value: params.ampScale },
      uSpeed: { value: params.speed },
      uChop: { value: params.windChop },
      uNear: { value: new THREE.Color("#244a63") }, // golden-hour sea
      uFar: { value: new THREE.Color("#3a3357") },
      uGlitter: { value: new THREE.Color("#ffbe78") },
      uSunDir: { value: new THREE.Vector3(...sunDir) },
      uFog: { value: new THREE.Color("#e7ab73") },
      uFogDensity: { value: 0.014 },
      uSkyHigh: { value: new THREE.Color("#6a6196") },
      uSkyLow: { value: new THREE.Color("#f0a766") },
      uCoastX: { value: 3.0 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // keep conditions-driven uniforms current without recreating the material
  uniforms.uAmp.value = params.ampScale;
  uniforms.uSpeed.value = params.speed;
  uniforms.uChop.value = params.windChop;

  useFrame((_, delta) => {
    if (matRef.current) {
      (matRef.current.uniforms.uTime.value as number) += delta;
    }
  });

  return (
    // One large Gerstner plane. It's big enough that its far edge is fully dissolved
    // into the fog at the horizon — no seam, no visible square edge.
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <planeGeometry args={[460, 460, 400, 400]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
      />
    </mesh>
  );
}
