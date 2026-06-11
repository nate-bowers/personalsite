"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const PUFF_OFFSETS: [number, number, number][] = [
  [0, 0, 0],
  [0.7, 0.12, 0.2],
  [-0.6, 0.06, -0.15],
  [0.25, 0.28, 0.3],
  [-0.3, 0.2, 0.28],
  [1.1, -0.05, -0.1],
];

function Puff({ position, scale }: { position: [number, number, number]; scale: number }) {
  return (
    <group position={position} scale={scale}>
      {PUFF_OFFSETS.map((o, i) => (
        <mesh key={i} position={o}>
          <sphereGeometry args={[0.5, 10, 8]} />
          <meshStandardMaterial color="#f6e6d6" roughness={1} metalness={0} transparent opacity={0.55} />
        </mesh>
      ))}
    </group>
  );
}

// base position, scale, drift speed — high and far so they read as a band of
// sunset cloud near the horizon, never blocking the camera
const CLOUDS: { p: [number, number, number]; s: number; v: number }[] = [
  { p: [-14, 16, -26], s: 2.2, v: 0.05 },
  { p: [6, 18.5, -30], s: 2.8, v: 0.07 },
  { p: [18, 15.5, -20], s: 2.3, v: 0.04 },
  { p: [-22, 17, -12], s: 2.0, v: 0.06 },
  { p: [-4, 19, -34], s: 3.0, v: 0.08 },
];

const SPAN = 64;

/** Warm sunset cloud puffs that drift slowly across the sky. */
export default function Clouds() {
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    const g = ref.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    g.children.forEach((child, i) => {
      const base = CLOUDS[i].p[0];
      const x = (((base + t * CLOUDS[i].v + SPAN / 2) % SPAN) + SPAN) % SPAN - SPAN / 2;
      child.position.x = x;
    });
  });

  return (
    <group ref={ref}>
      {CLOUDS.map((c, i) => (
        <Puff key={i} position={c.p} scale={c.s} />
      ))}
    </group>
  );
}
