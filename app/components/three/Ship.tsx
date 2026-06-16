"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Conditions } from "@/lib/ndbc";
import type { OpennessField } from "@/lib/openness";
import type { TerrainData } from "@/lib/terrain";
import { oceanParams } from "@/lib/ocean-map";
import { waterSurface, dispFade } from "@/lib/gerstner";

/**
 * A single container ship crossing the far offshore shipping lane, very slowly,
 * roughly N->S near the SF approach. It sits way out on the open Pacific (deep
 * negative x) so it reads as a distant, fog-dissolved silhouette — a calm
 * vessel on the horizon, never a hero object. It heaves gently on the same live
 * Gerstner sea as the buoys/ferry but stays nearly level.
 *
 * Built local-space "fore-to-aft along +z": bow at +z, stern at -z. The whole
 * group is yaw-rotated to face its travel direction each frame.
 */

// --- placement / motion ---------------------------------------------------
const LANE_X = -8.0; // shipping lane: on the visible offshore water but pushed toward the left frame edge so it reads as a passing vessel, not a hero object
const LANE_SWAY = 1.1; // gentle E/W drift so the track isn't a dead-straight line
const Z_SOUTH = 3.0; // south end of the run — capped well north of the camera (z=7) so the ship never balloons into the foreground
const Z_SPAN = 12.0; // crossing length: sails from the lower-left water up into the western haze, then wraps
const SPEED = 0.16; // units/s — a slow container ship at distance
const SCALE = 1.0; // reads as a distant passing ship without dominating the foreground

// In-palette, desaturated container colors (weathered, tasteful).
const CONTAINER_COLORS = [
  "#b5482e", // weathered rust-orange (accent family)
  "#3d3357", // slate
  "#e6e0d4", // cream
  "#c97b4a", // land-lit ochre
  "#a8896f", // desaturated fog/tan
] as const;

function buildHull(): THREE.BufferGeometry {
  // Long low flat hull. Bow tapers to a point at +z; flat transom at -z.
  // Box body + a wedge bow, merged into one geometry.
  const parts: THREE.BufferGeometry[] = [];

  const L = 2.2; // length of the box section
  const W = 0.42; // beam
  const H = 0.18; // freeboard

  const body = new THREE.BoxGeometry(W, H, L);
  body.translate(0, H / 2, -0.25); // shift aft so the bow wedge extends forward
  parts.push(body);

  // bow wedge: a short box pinched to a vertical edge at the very front.
  const bow = new THREE.BoxGeometry(W, H, 0.65);
  const pos = bow.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    if (z > 0) {
      // taper the leading face to a knife edge
      pos.setX(i, pos.getX(i) * 0.12);
    }
  }
  bow.computeVertexNormals();
  bow.translate(0, H / 2, L - 0.25 + 0.325 - 0.001);
  parts.push(bow);

  const g = mergeGeometries(parts, false);
  return g ?? body;
}

function buildContainerStack(color: THREE.Color): THREE.BufferGeometry {
  // Amidships block of containers as one merged geometry per color. We build a
  // grid (across beam x up x along length) and assign cells to this color via a
  // deterministic hash so each color owns a scattered subset — reads as a mixed
  // stack, not solid blocks. Returns null-safe geometry (may be empty).
  const parts: THREE.BufferGeometry[] = [];

  const cols = 3; // across the beam
  const rows = 4; // height of the stack
  const bays = 7; // along the length
  const cw = 0.115; // container width
  const ch = 0.085; // container height
  const cl = 0.235; // container length (along ship)
  const gap = 0.006;

  const cx0 = -((cols - 1) * (cw + gap)) / 2;
  const cz0 = -((bays - 1) * (cl + gap)) / 2;

  for (let b = 0; b < bays; b++) {
    // stack steps down toward bow & stern for a believable cargo profile
    const edge = Math.min(b, bays - 1 - b);
    const stackH = Math.min(rows, edge + 2);
    for (let r = 0; r < stackH; r++) {
      for (let cI = 0; cI < cols; cI++) {
        // deterministic color assignment
        const h = (b * 73 + r * 31 + cI * 17 + 11) % CONTAINER_COLORS.length;
        if (CONTAINER_COLORS[h] !== ("#" + color.getHexString())) continue;
        const box = new THREE.BoxGeometry(cw, ch, cl);
        box.translate(
          cx0 + cI * (cw + gap),
          ch / 2 + r * (ch + gap),
          cz0 + b * (cl + gap),
        );
        parts.push(box);
      }
    }
  }

  if (parts.length === 0) return new THREE.BufferGeometry();
  return mergeGeometries(parts, false) ?? new THREE.BufferGeometry();
}

export default function Ship({
  conditions,
  openness,
  data,
}: {
  conditions: Conditions;
  openness: OpennessField;
  data: TerrainData;
}) {
  void data;
  const ref = useRef<THREE.Group>(null);
  const params = useMemo(() => oceanParams(conditions), [conditions]);

  const hullGeo = useMemo(() => buildHull(), []);
  // One merged geometry per container color — keeps draw calls to a handful.
  const stacks = useMemo(
    () =>
      CONTAINER_COLORS.map((hex) => ({
        hex,
        geo: buildContainerStack(new THREE.Color(hex)),
      })),
    [],
  );

  useFrame((state) => {
    const g = ref.current;
    if (!g) return;
    const t = state.clock.elapsedTime;

    // long slow N->S crossing; wraps far off-frame. Phase offset so a crossing
    // is already underway on first load.
    const d = (t * SPEED + 3) % Z_SPAN;
    const cz = Z_SOUTH - d;
    const cx = LANE_X + Math.sin(t * 0.012) * LANE_SWAY;

    // heading: travel is mostly -z (south) with a touch of the sway velocity
    const vz = -SPEED;
    const vx = Math.cos(t * 0.012) * LANE_SWAY * 0.012;

    const cam = state.camera.position;
    const fade = dispFade(Math.hypot(cam.x - cx, cam.z - cz));
    const open = openness.sample(cx, cz) * fade;
    const s = waterSurface(cx, cz, t, params, open);

    // sit the hull's waterline just at the surface; gentle heave only
    g.position.set(cx, s.height + 0.05, cz);

    // local +z points to the bow → yaw to face travel direction
    g.rotation.y = Math.atan2(vx, vz);
    // very mild pitch/roll from the surface normal so it stays nearly level
    g.rotation.x = s.normal[2] * 0.12;
    g.rotation.z = -s.normal[0] * 0.12;
  });

  return (
    <group ref={ref} scale={SCALE}>
      {/* hull: dark slate body */}
      <mesh geometry={hullGeo}>
        <meshStandardMaterial
          color="#2f2a3d"
          roughness={0.85}
          emissive="#2f2a3d"
          emissiveIntensity={0.3}
        />
      </mesh>
      {/* rusty waterline strip along the hull */}
      <mesh position={[0, 0.012, -0.25]}>
        <boxGeometry args={[0.44, 0.05, 2.18]} />
        <meshStandardMaterial
          color="#7a3a26"
          roughness={0.9}
          emissive="#7a3a26"
          emissiveIntensity={0.28}
        />
      </mesh>

      {/* containers amidships — one merged mesh per color */}
      <group position={[0, 0.18, 0.05]}>
        {stacks.map(({ hex, geo }) => (
          <mesh key={hex} geometry={geo}>
            <meshStandardMaterial
              color={hex}
              roughness={0.8}
              emissive={hex}
              emissiveIntensity={0.3}
            />
          </mesh>
        ))}
      </group>

      {/* bridge superstructure at the stern (cream) */}
      <mesh position={[0, 0.34, -0.92]}>
        <boxGeometry args={[0.34, 0.34, 0.3]} />
        <meshStandardMaterial
          color="#e6e0d4"
          roughness={0.7}
          emissive="#e6e0d4"
          emissiveIntensity={0.32}
        />
      </mesh>
      {/* bridge wing / upper deck (slightly narrower top) */}
      <mesh position={[0, 0.55, -0.92]}>
        <boxGeometry args={[0.26, 0.1, 0.24]} />
        <meshStandardMaterial
          color="#d9d2c3"
          roughness={0.7}
          emissive="#d9d2c3"
          emissiveIntensity={0.3}
        />
      </mesh>
      {/* funnel just aft of the bridge */}
      <mesh position={[0, 0.62, -1.12]}>
        <boxGeometry args={[0.14, 0.2, 0.16]} />
        <meshStandardMaterial
          color="#b5482e"
          roughness={0.8}
          emissive="#b5482e"
          emissiveIntensity={0.32}
        />
      </mesh>
    </group>
  );
}
