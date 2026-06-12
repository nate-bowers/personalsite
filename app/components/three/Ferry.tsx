"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { lngLatToScene, type TerrainData } from "@/lib/terrain";
import type { Conditions } from "@/lib/ndbc";
import type { OpennessField } from "@/lib/openness";
import { oceanParams } from "@/lib/ocean-map";
import { waterSurface, dispFade } from "@/lib/gerstner";

/** A little ferry crossing the Golden Gate strait, riding the same damped
 * Gerstner surface as the water mesh (calm inside the gate, swell outside). */
export default function Ferry({
  data,
  conditions,
  openness,
}: {
  data: TerrainData;
  conditions: Conditions;
  openness: OpennessField;
}) {
  const ref = useRef<THREE.Group>(null);
  const params = useMemo(() => oceanParams(conditions), [conditions]);
  const base = useMemo(() => {
    const [gx, gz] = lngLatToScene(data.meta, -122.4783, 37.8199);
    return { gx: gx - 0.55, gz };
  }, [data]);

  useFrame((state) => {
    const g = ref.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    const phase = (t % 30) / 30;
    const z = base.gz - 0.55 + phase * 1.1;
    const x = base.gx + Math.sin(phase * Math.PI) * 0.2;
    const cam = state.camera.position;
    const fade = dispFade(Math.hypot(cam.x - x, cam.z - z));
    const s = waterSurface(x, z, t, params, openness.sample(x, z) * fade);
    g.position.set(x, s.height + 0.012, z);
    g.rotation.set(s.normal[2] * 0.4, 0, -s.normal[0] * 0.4);
  });

  return (
    <group ref={ref} scale={0.7}>
      <mesh position={[0, 0.025, 0]}>
        <boxGeometry args={[0.1, 0.05, 0.26]} />
        <meshStandardMaterial color="#eae4d6" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.025, 0.16]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.05, 0.08, 4]} />
        <meshStandardMaterial color="#eae4d6" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.075, -0.02]}>
        <boxGeometry args={[0.07, 0.05, 0.12]} />
        <meshStandardMaterial color="#b5482e" roughness={0.7} />
      </mesh>
    </group>
  );
}
