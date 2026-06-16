"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

type V3 = [number, number, number];

function box(w: number, h: number, d: number, x: number, y: number, z: number) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

// cylinder whose axis points along the horizontal `axis` ("x" | "z")
function hCyl(r: number, len: number, axis: "x" | "z", x: number, y: number, z: number, seg = 12) {
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  if (axis === "z") g.rotateX(Math.PI / 2);
  else g.rotateZ(Math.PI / 2);
  g.translate(x, y, z);
  return g;
}

export default function HooverTower({ pos }: { pos: V3 }) {
  const { buff, dark, red, clock } = useMemo(() => {
    const buffParts: THREE.BufferGeometry[] = [];
    const darkParts: THREE.BufferGeometry[] = [];
    const redParts: THREE.BufferGeometry[] = [];
    const clockParts: THREE.BufferGeometry[] = [];

    /* ---------- buff sandstone ---------- */
    // plinth + slightly battered base
    buffParts.push(box(0.3, 0.1, 0.3, 0, 0.05, 0));
    buffParts.push(box(0.21, 0.14, 0.21, 0, 0.16, 0));
    // main shaft (near-square plan)
    buffParts.push(box(0.17, 1.45, 0.17, 0, 0.825, 0));
    // cornice below the loggia
    buffParts.push(box(0.23, 0.03, 0.23, 0, 1.565, 0));
    // loggia wall (arches are cut from this visually by dark inserts)
    buffParts.push(box(0.21, 0.26, 0.21, 0, 1.7, 0));
    // cornice above the loggia + balustrade band
    buffParts.push(box(0.25, 0.035, 0.25, 0, 1.845, 0));
    buffParts.push(box(0.235, 0.04, 0.235, 0, 1.88, 0));
    // lantern drum on top of the dome
    {
      const drum = new THREE.CylinderGeometry(0.028, 0.028, 0.08, 12);
      drum.translate(0, 2.035, 0);
      buffParts.push(drum);
    }
    // Hoover Institution wings flanking the base (low blocks)
    buffParts.push(box(0.18, 0.11, 0.22, 0.24, 0.055, 0));
    buffParts.push(box(0.18, 0.11, 0.22, -0.24, 0.055, 0));

    /* ---------- dark recesses ---------- */
    // loggia: three round-arched openings per face, all four faces
    const offs = [-0.06, 0, 0.06];
    for (const o of offs) {
      for (const s of [1, -1]) {
        // north/south faces
        darkParts.push(box(0.04, 0.155, 0.022, o, 1.675, s * 0.1));
        darkParts.push(hCyl(0.02, 0.022, "z", o, 1.7525, s * 0.1));
        // east/west faces
        darkParts.push(box(0.022, 0.155, 0.04, s * 0.1, 1.675, o));
        darkParts.push(hCyl(0.02, 0.022, "x", s * 0.1, 1.7525, o));
      }
    }
    // vertical window-slot lines up the shaft (paired, all four faces)
    darkParts.push(box(0.016, 1.2, 0.174, 0.026, 0.78, 0));
    darkParts.push(box(0.016, 1.2, 0.174, -0.026, 0.78, 0));
    darkParts.push(box(0.174, 1.2, 0.016, 0, 0.78, 0.026));
    darkParts.push(box(0.174, 1.2, 0.016, 0, 0.78, -0.026));
    // clock surrounds (dark rim behind each face)
    for (const s of [1, -1]) {
      darkParts.push(hCyl(0.031, 0.012, "z", 0, 1.47, s * 0.083, 16));
      darkParts.push(hCyl(0.031, 0.012, "x", s * 0.083, 1.47, 0, 16));
    }
    // open band in the lantern
    {
      const band = new THREE.CylinderGeometry(0.0295, 0.0295, 0.034, 12);
      band.translate(0, 2.045, 0);
      darkParts.push(band);
    }

    /* ---------- red clay tile ---------- */
    // the dome: squashed hemisphere, gently curved (NOT a cone)
    {
      const dome = new THREE.SphereGeometry(0.112, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);
      dome.scale(1, 0.92, 1);
      dome.translate(0, 1.9, 0);
      redParts.push(dome);
    }
    // tiny dome on the lantern
    {
      const cap = new THREE.SphereGeometry(0.037, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      cap.scale(1, 0.9, 1);
      cap.translate(0, 2.072, 0);
      redParts.push(cap);
    }
    // hipped tile roofs on the wings
    for (const s of [1, -1]) {
      const roof = new THREE.ConeGeometry(0.1485, 0.07, 4);
      roof.rotateY(Math.PI / 4);
      roof.scale(1, 1, 1.19);
      roof.translate(s * 0.24, 0.145, 0);
      redParts.push(roof);
    }

    /* ---------- clock faces ---------- */
    for (const s of [1, -1]) {
      clockParts.push(hCyl(0.023, 0.012, "z", 0, 1.47, s * 0.086, 16));
      clockParts.push(hCyl(0.023, 0.012, "x", s * 0.086, 1.47, 0, 16));
    }

    return {
      buff: mergeGeometries(buffParts),
      dark: mergeGeometries(darkParts),
      red: mergeGeometries(redParts),
      clock: mergeGeometries(clockParts),
    };
  }, []);

  return (
    <group position={pos} scale={1.4}>
      <mesh geometry={buff}>
        <meshStandardMaterial color="#ddc99c" roughness={0.85} emissive="#ddc99c" emissiveIntensity={0.3} />
      </mesh>
      <mesh geometry={dark}>
        <meshStandardMaterial color="#54452e" roughness={0.95} />
      </mesh>
      <mesh geometry={red}>
        <meshStandardMaterial color="#a4502f" roughness={0.7} emissive="#a4502f" emissiveIntensity={0.3} />
      </mesh>
      <mesh geometry={clock}>
        <meshStandardMaterial color="#f0e8d2" roughness={0.6} emissive="#f0e8d2" emissiveIntensity={0.35} />
      </mesh>
    </group>
  );
}
