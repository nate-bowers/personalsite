"use client";

import { Html } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { terrainYAtScene, type TerrainData } from "@/lib/terrain";

/**
 * Faint place names on the terrain in mono (DESIGN-PHASE2.md §2 / FIX 3d):
 * STINSON · MAVERICKS · SANTA CRUZ · BIG SUR. Always visible, never
 * interactive — they make the geography legible to non-surfers without
 * competing with the buoy labels.
 */
export default function PlaceNames({ data }: { data: TerrainData }) {
  // On compact (portrait/mobile) the pulled-back framing crowds the buoy labels
  // into a thin band; the terrain place-names would overlap them, so drop them.
  const compact = useThree((s) => s.size.width < 768);
  if (compact) return null;
  return (
    <group>
      {data.places.map((p) => (
        <Html
          key={p.name}
          position={[p.x, terrainYAtScene(data, p.x, p.z) + 0.22, p.z]}
          center
          zIndexRange={[5, 0]}
          style={{ pointerEvents: "none" }}
        >
          <span
            className="font-mono select-none whitespace-nowrap text-[10px] uppercase"
            style={{ color: "rgba(251, 243, 228, 0.5)", letterSpacing: "0.34em" }}
          >
            {p.name}
          </span>
        </Html>
      ))}
    </group>
  );
}
