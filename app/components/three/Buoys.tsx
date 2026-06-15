"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { useRouter } from "next/navigation";
import * as THREE from "three";
import type { Conditions } from "@/lib/ndbc";
import type { TerrainData, Anchor } from "@/lib/terrain";
import type { OpennessField } from "@/lib/openness";
import { oceanParams } from "@/lib/ocean-map";
import { waterSurface, dispFade } from "@/lib/gerstner";
import { TOKENS } from "./atmosphere";

const UP = new THREE.Vector3(0, 1, 0);

// Display overrides for the floating buoy labels (the anchors.json labels stay
// the canonical section names).
const LABELS: Record<string, string> = {
  about: "About me",
  contact: "Contact me",
};

/**
 * NOAA 3-metre discus buoy (DESIGN-PHASE2.md §4 / FIX 4), ~480 triangles:
 * flat tapered disc hull in accent orange with a cream deck ring, tripod
 * lattice mast with cross-brace, instrument box, tilted solar panel, antenna
 * and a warm nav light. It sits IN the water: each frame it samples the same
 * Gerstner field that displaces the surface (with the local open-water
 * damping) for heave, and slerps toward the wave normal for pitch/roll.
 */
function BuoyModel() {
  const legTilt = 0.24;
  const legLen = 0.34;
  const legs = useMemo(
    () =>
      [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].map((a) => ({
        pos: [Math.cos(a) * 0.085, 0.21, Math.sin(a) * 0.085] as [number, number, number],
        rot: [Math.sin(a) * legTilt, 0, -Math.cos(a) * legTilt] as [number, number, number],
      })),
    [],
  );
  return (
    <group>
      {/* discus hull — flat tapered disc, weathered accent orange */}
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.17, 0.125, 0.075, 18]} />
        <meshStandardMaterial color={TOKENS.accent} roughness={0.8} metalness={0.05} />
      </mesh>
      {/* shallow keel cone under the waterline */}
      <mesh position={[0, -0.035, 0]}>
        <coneGeometry args={[0.12, 0.09, 14]} />
        <meshStandardMaterial color="#b23f1e" roughness={0.9} />
      </mesh>
      {/* cream deck ring */}
      <mesh position={[0, 0.063, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.018, 16]} />
        <meshStandardMaterial color="#e8e2d0" roughness={0.7} />
      </mesh>
      {/* tripod lattice mast */}
      {legs.map((l, i) => (
        <mesh key={i} position={l.pos} rotation={l.rot}>
          <cylinderGeometry args={[0.006, 0.008, legLen, 5]} />
          <meshStandardMaterial color="#d9d2c0" roughness={0.6} />
        </mesh>
      ))}
      {/* mid-height cross brace ring */}
      <mesh position={[0, 0.22, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.062, 0.005, 4, 9]} />
        <meshStandardMaterial color="#d9d2c0" roughness={0.6} />
      </mesh>
      {/* instrument box on the mast platform */}
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[0.075, 0.05, 0.075]} />
        <meshStandardMaterial color="#cfc8b4" roughness={0.65} />
      </mesh>
      {/* tilted solar panel */}
      <mesh position={[0.045, 0.45, 0]} rotation={[0, 0, -0.5]}>
        <boxGeometry args={[0.07, 0.006, 0.055]} />
        <meshStandardMaterial color="#1d2a44" roughness={0.35} metalness={0.4} />
      </mesh>
      {/* antenna */}
      <mesh position={[-0.03, 0.5, 0]}>
        <cylinderGeometry args={[0.0035, 0.0035, 0.14, 4]} />
        <meshStandardMaterial color="#d9d2c0" roughness={0.5} />
      </mesh>
      {/* nav light — warm, blooms gently */}
      <mesh position={[0, 0.475, 0]}>
        <sphereGeometry args={[0.016, 8, 6]} />
        <meshStandardMaterial
          color={TOKENS.accent}
          emissive={TOKENS.accent}
          emissiveIntensity={1.6}
        />
      </mesh>
    </group>
  );
}

function OneBuoy({
  anchor,
  conditions,
  open,
}: {
  anchor: Anchor;
  conditions: Conditions;
  open: number;
}) {
  const router = useRouter();
  const group = useRef<THREE.Group>(null);
  const labelRef = useRef<HTMLButtonElement>(null);
  const params = oceanParams(conditions);
  const targetQ = useRef(new THREE.Quaternion());
  const normal = useRef(new THREE.Vector3());

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    // identical amplitude to the rendered surface: local exposure × the same
    // camera-distance fade the vertex shader applies
    const cam = state.camera.position;
    const fade = dispFade(Math.hypot(cam.x - anchor.x, cam.z - anchor.z));
    const s = waterSurface(anchor.x, anchor.z, state.clock.elapsedTime, params, open * fade);
    g.position.set(anchor.x, s.height, anchor.z);
    normal.current.set(s.normal[0], s.normal[1], s.normal[2]);
    targetQ.current.setFromUnitVectors(UP, normal.current);
    g.quaternion.slerp(targetQ.current, 0.16); // heave + pitch/roll with the wave
  });

  // clarity rule: focus returns to the buoy that opened the panel (3D renderer)
  useEffect(() => {
    try {
      if (sessionStorage.getItem("lineup-return") === anchor.slug) {
        sessionStorage.removeItem("lineup-return");
        labelRef.current?.focus();
      }
    } catch {
      /* ignore */
    }
  }, [anchor.slug]);

  const openPanel = () => router.push(`/${anchor.slug}`);
  // Warm this station's route on first engagement (hover / press) so its panel
  // is already cached when the click lands — instant even on slow devices/links.
  const warm = () => router.prefetch(`/${anchor.slug}`);

  return (
    <group
      ref={group}
      onClick={(e) => {
        e.stopPropagation();
        openPanel();
      }}
      onPointerDown={warm}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
        warm();
      }}
      onPointerOut={() => (document.body.style.cursor = "")}
    >
      <BuoyModel />
      {/* generous invisible raycast target so the whole buoy is easy to click/tap
          (visible={false} on the material skips the render pass entirely while
          the geometry stays raycastable) */}
      <mesh position={[0, 0.2, 0]}>
        <sphereGeometry args={[0.85, 12, 10]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      {/* always-visible, keyboard-focusable label (billboards toward the camera) */}
      <Html position={[0, 0.78, 0]} center zIndexRange={[10, 6]}>
        <button
          ref={labelRef}
          type="button"
          onPointerDown={warm}
          onPointerEnter={warm}
          onClick={openPanel}
          aria-label={`Open ${LABELS[anchor.slug] ?? anchor.label} — station ${anchor.place}`}
          className="buoy3d-label font-mono cursor-pointer whitespace-nowrap rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-tight sm:px-2 sm:text-[11px] sm:tracking-wide"
          style={{
            background: "color-mix(in srgb, var(--panel-bg) 82%, transparent)",
            color: "var(--panel-ink)",
          }}
        >
          {LABELS[anchor.slug] ?? anchor.label}
        </button>
      </Html>
    </group>
  );
}

export default function Buoys({
  terrain,
  conditions,
  openness,
}: {
  terrain: TerrainData;
  conditions: Conditions;
  openness: OpennessField;
}) {
  // raw field — the SAME value the water mesh bakes into its aOpen attribute,
  // so a buoy can never out-bob the surface it floats on
  const opens = useMemo(
    () => terrain.anchors.map((a) => openness.sample(a.x, a.z)),
    [terrain, openness],
  );
  return (
    <group>
      {terrain.anchors.map((a, i) => (
        <OneBuoy key={a.slug} anchor={a} conditions={conditions} open={opens[i]} />
      ))}
    </group>
  );
}
