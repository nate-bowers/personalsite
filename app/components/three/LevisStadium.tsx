"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

type V3 = [number, number, number];

/** Triangular grandstand prism: depth runs +X from 0, height hFront->hBack, length centered on Z. */
function wedge(len: number, depth: number, hFront: number, hBack: number) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(depth, 0);
  s.lineTo(depth, hBack);
  s.lineTo(0, hFront);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false });
  g.translate(0, 0, -len / 2);
  return g;
}

function box(w: number, h: number, d: number, x: number, y: number, z: number) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

function plate(w: number, d: number, x: number, y: number, z: number) {
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);
  g.translate(x, y, z);
  return g;
}

function merge(parts: THREE.BufferGeometry[]) {
  return mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)))!;
}

/**
 * Levi's Stadium — rectangular open bowl, green gridiron, west suite tower
 * carrying the white steel roof deck + three solar canopies, end scoreboards.
 * Long axis = local X. Suite tower on -Z; lower east stand on +Z.
 */
export default function LevisStadium({ pos }: { pos: V3 }) {
  const { grey, darkTier, red, darkPanel, white, field, endzones } = useMemo(() => {
    const Y0 = 0.024; // plinth top

    // ---- concrete (warm grey): plinth + four lower grandstands (open corners)
    const greyParts: THREE.BufferGeometry[] = [
      box(0.98, 0.024, 0.8, 0, 0.012, 0),
    ];
    // east lower stand (+Z)
    const east = wedge(0.78, 0.2, 0.03, 0.15);
    east.rotateY(-Math.PI / 2);
    east.translate(0, Y0, 0.17);
    greyParts.push(east);
    // west lower stand (-Z), tower rises behind it
    const west = wedge(0.78, 0.12, 0.03, 0.13);
    west.rotateY(Math.PI / 2);
    west.translate(0, Y0, -0.17);
    greyParts.push(west);
    // end stands (+X / -X), low and open
    const endP = wedge(0.5, 0.13, 0.03, 0.11);
    endP.translate(0.33, Y0, 0);
    greyParts.push(endP);
    const endN = wedge(0.5, 0.13, 0.03, 0.11);
    endN.rotateY(Math.PI);
    endN.translate(-0.33, Y0, 0);
    greyParts.push(endN);

    // ---- darker upper tier on the east side
    const eastUpper = wedge(0.66, 0.11, 0.012, 0.085);
    eastUpper.rotateY(-Math.PI / 2);
    eastUpper.translate(0, 0.165, 0.26);
    const darkTierParts = [eastUpper];

    // ---- 49ers-red trim, sparingly: ribbon fascia under east upper deck + end rails
    const redParts = [
      box(0.66, 0.045, 0.018, 0, 0.143, 0.262),
      box(0.015, 0.018, 0.5, 0.452, 0.128, 0),
      box(0.015, 0.018, 0.5, -0.452, 0.128, 0),
      box(0.78, 0.018, 0.014, 0, 0.158, -0.284),
    ];

    // ---- dark glass / scoreboard panels
    const darkPanelParts = [
      // suite-tower glazing band
      box(0.78, 0.2, 0.12, 0, 0.145, -0.35),
      // end scoreboards + posts
      box(0.014, 0.09, 0.26, 0.47, 0.175, 0),
      box(0.014, 0.09, 0.26, -0.47, 0.175, 0),
      box(0.012, 0.1, 0.012, 0.47, 0.08, 0.07),
      box(0.012, 0.1, 0.012, 0.47, 0.08, -0.07),
      box(0.012, 0.1, 0.012, -0.47, 0.08, 0.07),
      box(0.012, 0.1, 0.012, -0.47, 0.08, -0.07),
    ];

    // ---- white steel: tower floor slabs, roof-deck frame, solar canopies, field lines
    const whiteParts: THREE.BufferGeometry[] = [
      box(0.8, 0.01, 0.13, 0, 0.115, -0.35),
      box(0.8, 0.01, 0.13, 0, 0.18, -0.35),
      box(0.82, 0.012, 0.14, 0, 0.247, -0.35),
      // roof-deck slab floating on thin columns (the solar terrace)
      box(0.88, 0.012, 0.2, 0, 0.332, -0.35),
    ];
    for (const cx of [-0.36, -0.18, 0, 0.18, 0.36]) {
      whiteParts.push(box(0.012, 0.075, 0.012, cx, 0.29, -0.3));
      whiteParts.push(box(0.012, 0.075, 0.012, cx, 0.29, -0.4));
    }
    // vertical fins on the west facade break up the glass band
    for (const cx of [-0.32, -0.16, 0, 0.16, 0.32]) {
      whiteParts.push(box(0.012, 0.2, 0.01, cx, 0.145, -0.412));
    }
    // three rooftop solar canopies
    for (const cx of [-0.3, 0, 0.3]) {
      whiteParts.push(box(0.22, 0.01, 0.12, cx, 0.372, -0.35));
      whiteParts.push(box(0.01, 0.034, 0.01, cx - 0.07, 0.352, -0.35));
      whiteParts.push(box(0.01, 0.034, 0.01, cx + 0.07, 0.352, -0.35));
    }
    // gridiron markings: sidelines, goal lines, and yard lines every "10 yards"
    whiteParts.push(plate(0.584, 0.007, 0, 0.036, 0.136));
    whiteParts.push(plate(0.584, 0.007, 0, 0.036, -0.136));
    whiteParts.push(plate(0.008, 0.272, 0.24, 0.036, 0));
    whiteParts.push(plate(0.008, 0.272, -0.24, 0.036, 0));
    for (let i = -4; i <= 4; i++) {
      whiteParts.push(plate(0.005, 0.264, i * 0.048, 0.036, 0));
    }

    // ---- field + end zones
    const fieldGeo = plate(0.58, 0.28, 0, 0.03, 0);
    const endzoneParts = [
      plate(0.05, 0.276, 0.265, 0.033, 0),
      plate(0.05, 0.276, -0.265, 0.033, 0),
    ];

    return {
      grey: merge(greyParts),
      darkTier: merge(darkTierParts),
      red: merge(redParts),
      darkPanel: merge(darkPanelParts),
      white: merge(whiteParts),
      field: fieldGeo,
      endzones: merge(endzoneParts),
    };
  }, []);

  return (
    <group position={pos} scale={3.4} rotation={[0, 0.35, 0]}>
      <mesh geometry={grey}>
        <meshStandardMaterial color="#a39a8d" roughness={0.9} emissive="#a39a8d" emissiveIntensity={0.25} />
      </mesh>
      <mesh geometry={darkTier}>
        <meshStandardMaterial color="#7d7468" roughness={0.9} emissive="#7d7468" emissiveIntensity={0.3} />
      </mesh>
      <mesh geometry={red}>
        <meshStandardMaterial color="#a4322a" roughness={0.85} emissive="#a4322a" emissiveIntensity={0.3} />
      </mesh>
      <mesh geometry={darkPanel}>
        <meshStandardMaterial color="#2e3136" roughness={0.6} emissive="#2e3136" emissiveIntensity={0.25} />
      </mesh>
      <mesh geometry={white}>
        <meshStandardMaterial color="#f0e9da" roughness={0.55} emissive="#f0e9da" emissiveIntensity={0.3} />
      </mesh>
      <mesh geometry={field}>
        <meshStandardMaterial color="#4e9c3b" roughness={1} emissive="#4e9c3b" emissiveIntensity={0.3} />
      </mesh>
      <mesh geometry={endzones}>
        <meshStandardMaterial color="#2c7026" roughness={1} emissive="#2c7026" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}
