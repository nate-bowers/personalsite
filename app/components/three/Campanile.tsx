"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

type V3 = [number, number, number];

/**
 * Sather Tower (the Campanile), UC Berkeley.
 * White-granite slender shaft + corner piers, dark tall belfry arches,
 * clock faces below the belfry, steep PALE granite pyramid, gold finial.
 * 5 draw calls, ~2k tris.
 */
export default function Campanile({ pos }: { pos: V3 }) {
  const { stone, dark, roof, dials, gold } = useMemo(() => {
    const box = (
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number
    ) => {
      const g = new THREE.BoxGeometry(w, h, d);
      g.translate(x, y, z);
      return g;
    };

    // ---------- white granite ----------
    const stoneParts: THREE.BufferGeometry[] = [];
    // plinth + base step
    stoneParts.push(box(0.26, 0.06, 0.26, 0, 0.03, 0));
    stoneParts.push(box(0.215, 0.08, 0.215, 0, 0.09, 0));
    // main shaft
    stoneParts.push(box(0.155, 1.52, 0.155, 0, 0.89, 0));
    // four corner piers, full height through the belfry
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        stoneParts.push(box(0.04, 1.82, 0.04, sx * 0.072, 1.04, sz * 0.072));
    // projecting course under the clock stage
    stoneParts.push(box(0.178, 0.02, 0.178, 0, 1.45, 0));
    // belfry frame (white arcade body the dark arches sit on)
    stoneParts.push(box(0.165, 0.33, 0.165, 0, 1.785, 0));
    // cornice above belfry (two steps)
    stoneParts.push(box(0.2, 0.026, 0.2, 0, 1.962, 0));
    stoneParts.push(box(0.222, 0.024, 0.222, 0, 1.987, 0));
    // low attic stage under the roof
    stoneParts.push(box(0.156, 0.06, 0.156, 0, 2.028, 0));
    // lantern at the spire top
    stoneParts.push(box(0.036, 0.062, 0.036, 0, 2.42, 0));
    // clock surrounds (square stone plates, one per face)
    for (let k = 0; k < 4; k++) {
      const g = new THREE.BoxGeometry(0.092, 0.092, 0.012);
      g.translate(0, 1.53, 0.08);
      g.rotateY((k * Math.PI) / 2);
      stoneParts.push(g);
    }

    // ---------- dark deep openings ----------
    const darkParts: THREE.BufferGeometry[] = [];
    // thin vertical reveals on the shaft, two per face
    for (let k = 0; k < 4; k++) {
      for (const sx of [-1, 1]) {
        const g = new THREE.BoxGeometry(0.011, 1.18, 0.012);
        g.translate(sx * 0.031, 0.84, 0.0745);
        g.rotateY((k * Math.PI) / 2);
        darkParts.push(g);
      }
    }
    // belfry: two tall narrow arched openings per face (one tall arcade)
    for (let k = 0; k < 4; k++) {
      for (const sx of [-1, 1]) {
        const shaft = new THREE.BoxGeometry(0.047, 0.26, 0.012);
        shaft.translate(sx * 0.034, 1.762, 0.082);
        shaft.rotateY((k * Math.PI) / 2);
        darkParts.push(shaft);
        const arch = new THREE.CylinderGeometry(0.0235, 0.0235, 0.012, 12);
        arch.rotateX(Math.PI / 2);
        arch.translate(sx * 0.034, 1.892, 0.082);
        arch.rotateY((k * Math.PI) / 2);
        darkParts.push(arch);
      }
    }
    // dark clock rings behind the dials
    for (let k = 0; k < 4; k++) {
      const g = new THREE.CylinderGeometry(0.036, 0.036, 0.01, 16);
      g.rotateX(Math.PI / 2);
      g.translate(0, 1.53, 0.088);
      g.rotateY((k * Math.PI) / 2);
      darkParts.push(g);
    }

    // ---------- pale granite roof ----------
    const roofParts: THREE.BufferGeometry[] = [];
    // steep four-sided pyramid (truncated where the lantern sits)
    const pyramid = new THREE.CylinderGeometry(0.024, 0.122, 0.335, 4, 1);
    pyramid.rotateY(Math.PI / 4);
    pyramid.translate(0, 2.222, 0);
    roofParts.push(pyramid);
    // small pyramid cap over the lantern
    const cap = new THREE.ConeGeometry(0.034, 0.05, 4);
    cap.rotateY(Math.PI / 4);
    cap.translate(0, 2.476, 0);
    roofParts.push(cap);

    // ---------- clock dials ----------
    const dialParts: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 4; k++) {
      const g = new THREE.CylinderGeometry(0.0305, 0.0305, 0.011, 16);
      g.rotateX(Math.PI / 2);
      g.translate(0, 1.53, 0.0905);
      g.rotateY((k * Math.PI) / 2);
      dialParts.push(g);
    }

    // ---------- gold finial ----------
    const goldParts: THREE.BufferGeometry[] = [];
    const stem = new THREE.CylinderGeometry(0.004, 0.004, 0.045, 6);
    stem.translate(0, 2.52, 0);
    goldParts.push(stem);
    const ball = new THREE.SphereGeometry(0.012, 10, 8);
    ball.translate(0, 2.545, 0);
    goldParts.push(ball);

    return {
      stone: mergeGeometries(stoneParts),
      dark: mergeGeometries(darkParts),
      roof: mergeGeometries(roofParts),
      dials: mergeGeometries(dialParts),
      gold: mergeGeometries(goldParts),
    };
  }, []);

  return (
    <group position={pos} scale={0.45}>
      <mesh geometry={stone}>
        <meshStandardMaterial
          color="#ebe6da"
          roughness={0.8}
          emissive="#ebe6da"
          emissiveIntensity={0.32}
        />
      </mesh>
      <mesh geometry={dark}>
        <meshStandardMaterial
          color="#3a3127"
          roughness={0.95}
          emissive="#3a3127"
          emissiveIntensity={0.12}
        />
      </mesh>
      <mesh geometry={roof}>
        <meshStandardMaterial
          color="#d8d1c0"
          roughness={0.85}
          emissive="#d8d1c0"
          emissiveIntensity={0.3}
        />
      </mesh>
      <mesh geometry={dials}>
        <meshStandardMaterial
          color="#f6efdc"
          roughness={0.6}
          emissive="#f6efdc"
          emissiveIntensity={0.6}
        />
      </mesh>
      <mesh geometry={gold}>
        <meshStandardMaterial
          color="#e0a83f"
          roughness={0.35}
          metalness={0.5}
          emissive="#e0a83f"
          emissiveIntensity={0.5}
        />
      </mesh>
    </group>
  );
}
