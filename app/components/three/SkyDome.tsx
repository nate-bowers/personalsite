"use client";

import { useMemo } from "react";
import * as THREE from "three";

/**
 * Stylized sky: a large back-facing dome with a vertical gradient (orange low ->
 * violet zenith) and a soft sun glow + bright core low in the west. The bright core
 * is what the bloom pass turns into a sun. Fog is off for the dome.
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
    float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 col = mix(uLow, uZenith, pow(h, 0.85));
    float s = max(dot(normalize(vDir), normalize(uSunDir)), 0.0);
    col += uSunGlow * pow(s, 22.0) * 0.85;   // soft halo
    col += uSunGlow * pow(s, 900.0) * 3.0;   // bright core (blooms into the sun)
    gl_FragColor = vec4(col, 1.0);
  }
`;

export default function SkyDome({ sunDir }: { sunDir: [number, number, number] }) {
  const uniforms = useMemo(
    () => ({
      uZenith: { value: new THREE.Color("#46406f") }, // deep violet overhead
      uLow: { value: new THREE.Color("#e7ab73") }, // warm horizon (matches fog)
      uSunGlow: { value: new THREE.Color("#ffd79c") },
      uSunDir: { value: new THREE.Vector3(...sunDir) },
    }),
    [sunDir],
  );

  return (
    <mesh scale={[-1, 1, 1]}>
      <sphereGeometry args={[120, 32, 16]} />
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
