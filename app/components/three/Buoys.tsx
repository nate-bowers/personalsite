"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { useRouter } from "next/navigation";
import * as THREE from "three";
import type { Conditions } from "@/lib/ndbc";
import type { TerrainData, Anchor } from "@/lib/terrain";
import { oceanParams } from "@/lib/ocean-map";
import { waterSurface } from "@/lib/gerstner";

const UP = new THREE.Vector3(0, 1, 0);

/** NOAA 3m discus buoy silhouette from primitives (~400 tris): disc hull, skirt,
 * lattice mast, instrument top. Rendered larger than life (DESIGN-PHASE2.md §4). */
function BuoyModel() {
  return (
    <group>
      <mesh position={[0, 0, 0]} castShadow>
        <cylinderGeometry args={[0.34, 0.3, 0.16, 20]} />
        <meshStandardMaterial color="#d8542a" roughness={0.75} metalness={0.1} />
      </mesh>
      <mesh position={[0, -0.13, 0]}>
        <coneGeometry args={[0.3, 0.2, 20]} />
        <meshStandardMaterial color="#b23f1e" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.33, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.52, 8]} />
        <meshStandardMaterial color="#e8e2d0" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.62, 0]}>
        <boxGeometry args={[0.13, 0.1, 0.13]} />
        <meshStandardMaterial color="#ff7847" emissive="#ff7847" emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

function OneBuoy({ anchor, conditions }: { anchor: Anchor; conditions: Conditions }) {
  const router = useRouter();
  const group = useRef<THREE.Group>(null);
  const params = oceanParams(conditions);
  const targetQ = useRef(new THREE.Quaternion());
  const normal = useRef(new THREE.Vector3());

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const s = waterSurface(anchor.x, anchor.z, state.clock.elapsedTime, params);
    g.position.set(anchor.x, s.height, anchor.z);
    normal.current.set(s.normal[0], s.normal[1], s.normal[2]);
    targetQ.current.setFromUnitVectors(UP, normal.current);
    g.quaternion.slerp(targetQ.current, 0.18); // heave + pitch/roll with the wave
  });

  const open = () => router.push(`/${anchor.slug}`);

  return (
    <group
      ref={group}
      onClick={(e) => {
        e.stopPropagation();
        open();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => (document.body.style.cursor = "")}
    >
      <BuoyModel />
      {/* generous invisible raycast target so the whole buoy is easy to click/tap */}
      <mesh position={[0, 0.35, 0]}>
        <sphereGeometry args={[1.2, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {/* always-visible, keyboard-focusable label (billboards toward the camera) */}
      <Html position={[0, 1.05, 0]} center>
        <button
          type="button"
          onClick={open}
          aria-label={`Open ${anchor.label} — station ${anchor.place}`}
          className="buoy3d-label font-mono cursor-pointer whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] uppercase tracking-wide"
          style={{
            background: "color-mix(in srgb, var(--panel-bg) 82%, transparent)",
            color: "var(--panel-ink)",
          }}
        >
          {anchor.label}
        </button>
      </Html>
    </group>
  );
}

export default function Buoys({ terrain, conditions }: { terrain: TerrainData; conditions: Conditions }) {
  return (
    <group>
      {terrain.anchors.map((a) => (
        <OneBuoy key={a.slug} anchor={a} conditions={conditions} />
      ))}
    </group>
  );
}
