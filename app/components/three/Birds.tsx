"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface BirdCfg {
  r: number;
  y: number;
  speed: number;
  phase: number;
  cx: number;
  cz: number;
}

const FLOCK: BirdCfg[] = [
  { r: 7, y: 6.4, speed: 0.16, phase: 0, cx: 2, cz: -6 },
  { r: 5, y: 7.1, speed: 0.2, phase: 1.5, cx: -3, cz: -8 },
  { r: 8, y: 5.8, speed: 0.13, phase: 3.0, cx: 4, cz: -4 },
  { r: 6, y: 6.7, speed: 0.18, phase: 4.5, cx: -5, cz: -5 },
  { r: 4.5, y: 7.5, speed: 0.23, phase: 2.2, cx: 0, cz: -10 },
];

function Bird({ cfg }: { cfg: BirdCfg }) {
  const group = useRef<THREE.Group>(null);
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime * cfg.speed + cfg.phase;
    g.position.set(cfg.cx + Math.cos(t) * cfg.r, cfg.y + Math.sin(t * 1.7) * 0.3, cfg.cz + Math.sin(t) * cfg.r);
    g.rotation.y = -t + Math.PI / 2;
    const flap = Math.sin(state.clock.elapsedTime * 9 + cfg.phase) * 0.5;
    if (left.current) left.current.rotation.z = 0.35 + flap;
    if (right.current) right.current.rotation.z = -0.35 - flap;
  });

  return (
    <group ref={group}>
      <group ref={left}>
        <mesh position={[-0.1, 0, 0]}>
          <boxGeometry args={[0.2, 0.014, 0.06]} />
          <meshStandardMaterial color="#3a3340" />
        </mesh>
      </group>
      <group ref={right}>
        <mesh position={[0.1, 0, 0]}>
          <boxGeometry args={[0.2, 0.014, 0.06]} />
          <meshStandardMaterial color="#3a3340" />
        </mesh>
      </group>
    </group>
  );
}

/** A small flock of birds circling slowly over the coast. */
export default function Birds() {
  return (
    <group>
      {FLOCK.map((cfg, i) => (
        <Bird key={i} cfg={cfg} />
      ))}
    </group>
  );
}
