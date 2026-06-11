"use client";

import { useMemo } from "react";
import { terrainYAtScene, type TerrainData } from "@/lib/terrain";

// Shared so the forest can keep a clearing around the water.
export const POND_X = 2.4;
export const POND_Z = -0.5;

/** A small calm pond tucked into the inland hills. */
export default function Pond({ data }: { data: TerrainData }) {
  const pos = useMemo(() => {
    const y = terrainYAtScene(data, POND_X, POND_Z);
    return [POND_X, y + 0.008, POND_Z] as [number, number, number];
  }, [data]);

  return (
    <mesh position={pos} rotation={[-Math.PI / 2, 0, 0]} scale={[1.7, 1, 1.15]} receiveShadow>
      <circleGeometry args={[0.82, 40]} />
      <meshStandardMaterial color="#4a7a92" roughness={0.14} metalness={0.4} />
    </mesh>
  );
}
