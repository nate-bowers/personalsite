"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Conditions } from "@/lib/ndbc";
import type { OpennessField } from "@/lib/openness";
import { oceanParams } from "@/lib/ocean-map";
import { waterSurface, dispFade } from "@/lib/gerstner";

/**
 * Quiet ambient life: a single jet crossing the sky with a fading contrail,
 * and a single shark fin cruising the open Pacific. Both deliberately small,
 * slow and unintrusive — garnish, not subject.
 */

// ---------------------------------------------------------------- the plane
const PLANE_Y = 10;
const PLANE_SPEED = 0.55; // units/s — reads as a distant cruising jet
const PLANE_SPAN = 95; // crossing length before it loops
const TRAIL_LEN = 7;

function Jet() {
  const group = useRef<THREE.Group>(null);

  // fading contrail: RGBA vertex colors on a tapered ribbon
  const trailGeo = useMemo(() => {
    const N = 24;
    const verts = new Float32Array((N + 1) * 2 * 3);
    const cols = new Float32Array((N + 1) * 2 * 4);
    const idx: number[] = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const x = -0.3 - t * TRAIL_LEN; // behind the nose
      const w = 0.015 + t * 0.075; // widens as it disperses
      const a = (1 - t) * 0.42; // fades out
      for (let s = 0; s < 2; s++) {
        const vi = (i * 2 + s) * 3;
        verts[vi] = x;
        verts[vi + 1] = 0;
        verts[vi + 2] = s === 0 ? -w : w;
        const ci = (i * 2 + s) * 4;
        cols[ci] = 1;
        cols[ci + 1] = 0.97;
        cols[ci + 2] = 0.94;
        cols[ci + 3] = a;
      }
      if (i < N) {
        const k = i * 2;
        idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(verts, 3));
    g.setAttribute("color", new THREE.BufferAttribute(cols, 4));
    g.setIndex(idx);
    return g;
  }, []);

  // tiny jet: fuselage + wings merged visually by proximity (2 meshes)
  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    // phased so a crossing is underway on first load; wraps far off-frame
    const d = (t * PLANE_SPEED + 35) % PLANE_SPAN;
    g.position.set(-50 + d, PLANE_Y, -20 + d * 0.12);
    g.rotation.y = -Math.atan2(0.12, 1);
  });

  return (
    <group ref={group}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[0.022, 0.16, 3, 6]} />
        <meshStandardMaterial color="#efeae0" roughness={0.5} />
      </mesh>
      <mesh>
        <boxGeometry args={[0.05, 0.008, 0.22]} />
        <meshStandardMaterial color="#e6e0d4" roughness={0.6} />
      </mesh>
      <mesh geometry={trailGeo}>
        <meshBasicMaterial vertexColors transparent depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ------------------------------------------------------------ the shark fin
function SharkFin({
  conditions,
  openness,
}: {
  conditions: Conditions;
  openness: OpennessField;
}) {
  const group = useRef<THREE.Group>(null);
  const params = oceanParams(conditions);

  // swept fin blade
  const finGeo = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0.085, 0);
    shape.quadraticCurveTo(0.07, 0.05, 0.025, 0.085); // swept trailing edge
    shape.quadraticCurveTo(0.005, 0.05, 0, 0);
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: false });
    g.translate(-0.04, 0, -0.006);
    return g;
  }, []);

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    // slow lissajous cruise in the visible open Pacific ahead of the camera
    const cx = -4.4 + Math.sin(t * 0.021) * 1.8;
    const cz = 1.0 + Math.sin(t * 0.034 + 1.2) * 2.2;
    const vx = Math.cos(t * 0.021) * 1.8 * 0.021;
    const vz = Math.cos(t * 0.034 + 1.2) * 2.2 * 0.034;
    const cam = state.camera.position;
    const fade = dispFade(Math.hypot(cam.x - cx, cam.z - cz));
    const s = waterSurface(cx, cz, t, params, openness.sample(cx, cz) * fade);
    // blade base just under the surface, tip slightly above — always visible
    g.position.set(cx, s.height - 0.012, cz);
    g.rotation.y = Math.atan2(-vz, vx) - Math.PI / 2 + Math.PI / 2;
    g.rotation.z = Math.sin(t * 0.9) * 0.06; // lazy sway
  });

  return (
    <group ref={group}>
      <mesh geometry={finGeo} rotation={[0, Math.PI / 2, 0]}>
        <meshStandardMaterial color="#39414c" roughness={0.55} />
      </mesh>
    </group>
  );
}

export default function Ambient({
  conditions,
  openness,
}: {
  conditions: Conditions;
  openness: OpennessField;
}) {
  return (
    <group>
      <Jet />
      <SharkFin conditions={conditions} openness={openness} />
    </group>
  );
}
