"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { TOKENS } from "./atmosphere";

/**
 * Stylized sky per the locked golden-hour tokens: a large back-facing dome,
 * zenith violet -> horizon orange, with a defined sun disc and a soft warm
 * glow low in the west. The disc's bright core is what the bloom pass turns
 * into the sun. The dome's radius (500) fully encloses the 320-unit water
 * plane — nothing in the scene can render outside it, which is what keeps
 * wave silhouettes from ever bleeding into the sky.
 */
const vertexShader = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uLow;
  uniform vec3 uSunGlow;
  uniform vec3 uSunDir;
  varying vec3 vDir;
  void main() {
    vec3 D = normalize(vDir);
    // orange holds the horizon band; violet takes over with altitude
    float t = clamp(D.y, 0.0, 1.0);
    vec3 col = mix(uLow, uZenith, pow(t, 0.45));

    float s = max(dot(D, normalize(uSunDir)), 0.0);
    col += uSunGlow * pow(s, 18.0) * 0.7;            // wide warm halo
    float disc = smoothstep(0.99965, 0.99985, s);    // crisp sun disc
    col += uSunGlow * disc * 2.4;                    // core that blooms
    gl_FragColor = vec4(col, 1.0);
  }
`;

export default function SkyDome({ sunDir }: { sunDir: [number, number, number] }) {
  const uniforms = useMemo(
    () => ({
      uZenith: { value: new THREE.Color(TOKENS.skyZenith) },
      uLow: { value: new THREE.Color(TOKENS.skyLow) },
      uSunGlow: { value: new THREE.Color(TOKENS.sunGlow) },
      uSunDir: { value: new THREE.Vector3(...sunDir) },
    }),
    [sunDir],
  );

  return (
    <mesh>
      <sphereGeometry args={[500, 48, 24]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        side={THREE.BackSide}
        depthWrite={false}
        fog={false}
      />
    </mesh>
  );
}
