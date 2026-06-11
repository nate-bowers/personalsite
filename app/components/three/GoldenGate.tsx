"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { lngLatToScene, type TerrainData } from "@/lib/terrain";

/**
 * The one landmark (FIX 3c): the Golden Gate Bridge, international orange,
 * spanning the real strait. Art-deco paired tower legs, catenary main cables,
 * suspender rods. Rendered larger than true scale — same compression license
 * as the geography (DESIGN-PHASE2.md §4).
 */

type V3 = [number, number, number];

function Cable({ a, b, sag }: { a: V3; b: V3; sag: number }) {
  const geo = useMemo(() => {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const mid = va.clone().add(vb).multiplyScalar(0.5);
    mid.y -= sag;
    const curve = new THREE.QuadraticBezierCurve3(va, mid, vb);
    return new THREE.TubeGeometry(curve, 24, 0.012, 5, false);
  }, [a, b, sag]);
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial color="#e35e30" roughness={0.6} />
    </mesh>
  );
}

function Suspenders({ a, b, sag, deckY, x }: { a: V3; b: V3; sag: number; deckY: number; x: number }) {
  const rods = useMemo(() => {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const mid = va.clone().add(vb).multiplyScalar(0.5);
    mid.y -= sag;
    const curve = new THREE.QuadraticBezierCurve3(va, mid, vb);
    const out: { y: number; z: number; h: number }[] = [];
    for (let i = 1; i < 12; i++) {
      const p = curve.getPoint(i / 12);
      const h = p.y - deckY;
      if (h > 0.04) out.push({ y: deckY + h / 2, z: p.z, h });
    }
    return out;
  }, [a, b, sag, deckY]);
  return (
    <>
      {rods.map((r, i) => (
        <mesh key={i} position={[x, r.y, r.z]}>
          <cylinderGeometry args={[0.004, 0.004, r.h, 4]} />
          <meshStandardMaterial color="#e35e30" roughness={0.6} />
        </mesh>
      ))}
    </>
  );
}

export default function GoldenGate({ data }: { data: TerrainData }) {
  const pos = useMemo<V3>(() => {
    const [x, z] = lngLatToScene(data.meta, -122.4783, 37.8199);
    return [x, 0, z];
  }, [data]);

  const towerH = 0.92;
  const span = 1.0;
  const deckY = 0.4;
  const tower = (z: number) => (
    <group position={[0, 0, z]}>
      {[-0.075, 0.075].map((dz, i) => (
        <mesh key={i} position={[0, towerH / 2, dz]}>
          <boxGeometry args={[0.085, towerH, 0.06]} />
          <meshStandardMaterial color="#e35e30" roughness={0.55} />
        </mesh>
      ))}
      {[0.32, 0.52, 0.72, 0.95].map((f, i) => (
        <mesh key={i} position={[0, towerH * f, 0]}>
          <boxGeometry args={[0.1, 0.045, 0.2]} />
          <meshStandardMaterial color="#e35e30" roughness={0.55} />
        </mesh>
      ))}
    </group>
  );

  return (
    <group position={pos} scale={0.55}>
      <mesh position={[0, deckY, 0]}>
        <boxGeometry args={[0.13, 0.045, span + 0.5]} />
        <meshStandardMaterial color="#c4542f" roughness={0.7} />
      </mesh>
      {tower(-span / 2)}
      {tower(span / 2)}
      <Cable a={[0.05, towerH, -span / 2]} b={[0.05, towerH, span / 2]} sag={towerH - deckY - 0.08} />
      <Cable a={[-0.05, towerH, -span / 2]} b={[-0.05, towerH, span / 2]} sag={towerH - deckY - 0.08} />
      <Suspenders a={[0.05, towerH, -span / 2]} b={[0.05, towerH, span / 2]} sag={towerH - deckY - 0.08} deckY={deckY} x={0.05} />
      <Suspenders a={[-0.05, towerH, -span / 2]} b={[-0.05, towerH, span / 2]} sag={towerH - deckY - 0.08} deckY={deckY} x={-0.05} />
    </group>
  );
}
