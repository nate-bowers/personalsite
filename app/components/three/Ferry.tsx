"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { lngLatToScene, type TerrainData } from "@/lib/terrain";
import type { Conditions } from "@/lib/ndbc";
import { oceanParams } from "@/lib/ocean-map";
import { waterSurface } from "@/lib/gerstner";

/** A little ferry that crosses the strait by the Golden Gate, bobbing on the live waves. */
export default function Ferry({ data, conditions }: { data: TerrainData; conditions: Conditions }) {
  const ref = useRef<THREE.Group>(null);
  const params = useMemo(() => oceanParams(conditions), [conditions]);
  const base = useMemo(() => {
    const [gx, gz] = lngLatToScene(data.meta, -122.478, 37.82);
    return { gx: gx - 1.0, gz };
  }, [data]);

  useFrame((state) => {
    const g = ref.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    const phase = (t % 26) / 26;
    const z = base.gz - 1.0 + phase * 2.0;
    const x = base.gx + Math.sin(phase * Math.PI) * 0.4;
    const s = waterSurface(x, z, t, params);
    g.position.set(x, s.height + 0.015, z);
    g.rotation.set(s.normal[2] * 0.4, 0, -s.normal[0] * 0.4);
  });

  return (
    <group ref={ref}>
      <mesh position={[0, 0.025, 0]} castShadow>
        <boxGeometry args={[0.1, 0.05, 0.26]} />
        <meshStandardMaterial color="#eae4d6" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.025, 0.16]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
        <coneGeometry args={[0.05, 0.08, 4]} />
        <meshStandardMaterial color="#eae4d6" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.075, -0.02]} castShadow>
        <boxGeometry args={[0.07, 0.05, 0.12]} />
        <meshStandardMaterial color="#b5482e" roughness={0.7} />
      </mesh>
    </group>
  );
}
