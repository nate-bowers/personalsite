"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { lngLatToScene, type TerrainData } from "@/lib/terrain";

/**
 * The one landmark (FIX 3c): the Golden Gate Bridge, international orange,
 * spanning the real strait. Stepped art-deco towers (paired legs across the
 * roadway, four portal struts with setbacks), truss-depth deck running shore
 * to shore, main cables sweeping tower-top to anchorage blocks, suspender
 * rods, and the Fort Point pylon pair at the south end. Rendered larger than
 * true scale — same compression license as the geography (DESIGN-PHASE2.md §4).
 *
 * Four draw calls: towers+pylons / deck+truss / cables / suspenders. The bridge
 * reads as pure international-orange structure — no grey concrete piers/anchorages.
 */

type V3 = [number, number, number];

const ORANGE = "#e35e30";
const ORANGE_DEEP = "#c9512c";

// ---- proportions (local units; group scale 0.55) -------------------------
const SPAN = 1.0; // tower-to-tower
const TOWER_Z = SPAN / 2; // towers at ±0.5
const DECK_Y = 0.4; // deck centreline
const DECK_TOP = DECK_Y + 0.008;
const DECK_W = 0.13;
const DECK_L = 1.64; // shore to shore (side spans + approaches)
const LEG_X = 0.082; // tower-leg centres straddle the roadway
const SADDLE_Y = 0.94; // cable saddle height

// art-deco tower: four portal struts, legs step back at each level
const STRUT_Y = [0.46, 0.626, 0.773, 0.902];
const SEG_BOT = [0, ...STRUT_Y];
const SEG_TOP = [...STRUT_Y, 0.945];
const SEG_W = [0.053, 0.046, 0.039, 0.032, 0.026]; // leg width (X) per level
const SEG_D = [0.112, 0.095, 0.079, 0.063, 0.05]; // leg depth (Z) per level
const STRUT_H = [0.048, 0.044, 0.04, 0.052];

function box(w: number, h: number, d: number, x: number, y: number, z: number) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

function mainCableCurve(sx: number) {
  // dips to just above the deck at midspan
  const low = DECK_TOP + 0.062;
  return new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(sx, SADDLE_Y, -TOWER_Z),
    new THREE.Vector3(sx, 2 * low - SADDLE_Y, 0),
    new THREE.Vector3(sx, SADDLE_Y, TOWER_Z),
  );
}

function sideCableCurve(sx: number, sz: number) {
  // saddle down to the anchorage face, mostly straight with a mild sag
  const a = new THREE.Vector3(sx, SADDLE_Y, sz * TOWER_Z);
  const b = new THREE.Vector3(sx, 0.46, sz * 0.79);
  const c = a.clone().add(b).multiplyScalar(0.5);
  c.y -= 0.045;
  return new THREE.QuadraticBezierCurve3(a, c, b);
}

function buildBridge() {
  // -- towers + Fort Point pylons (international orange) -------------------
  const towerParts: THREE.BufferGeometry[] = [];
  for (const tz of [-TOWER_Z, TOWER_Z]) {
    for (let s = 0; s < 5; s++) {
      const h = SEG_TOP[s] - SEG_BOT[s];
      const y = (SEG_TOP[s] + SEG_BOT[s]) / 2;
      for (const sx of [-LEG_X, LEG_X]) {
        towerParts.push(box(SEG_W[s], h, SEG_D[s], sx, y, tz));
      }
    }
    for (let i = 0; i < 4; i++) {
      towerParts.push(
        box(2 * LEG_X + SEG_W[i], STRUT_H[i], SEG_D[i + 1] * 0.9, 0, STRUT_Y[i], tz),
      );
    }
    for (const sx of [-LEG_X, LEG_X]) {
      towerParts.push(box(SEG_W[4] * 0.85, 0.018, SEG_D[4] * 0.8, sx, 0.954, tz)); // saddle cap
    }
    towerParts.push(box(2 * LEG_X * 0.62, 0.016, SEG_D[4] * 0.7, 0, 0.936, tz)); // crest pediment
  }
  // art-deco pylon pair on the south (SF) side span
  for (const sx of [-LEG_X, LEG_X]) {
    towerParts.push(box(0.032, 0.17, 0.048, sx, 0.455, 0.65));
    towerParts.push(box(0.024, 0.022, 0.038, sx, 0.551, 0.65)); // stepped crest
  }

  // -- deck + under-deck stiffening truss (deep orange) ---------------------
  const deckParts: THREE.BufferGeometry[] = [
    box(DECK_W, 0.016, DECK_L, 0, DECK_Y, 0), // roadway slab
  ];
  const chordY = 0.357;
  for (const sx of [-0.06, 0.06]) {
    deckParts.push(box(0.011, 0.011, DECK_L, sx, chordY, 0)); // bottom chords
  }
  const nBay = 20;
  const step = DECK_L / nBay;
  for (let i = 0; i <= nBay; i++) {
    const z = -DECK_L / 2 + i * step;
    for (const sx of [-0.06, 0.06]) {
      deckParts.push(box(0.007, 0.035, 0.007, sx, 0.3745, z)); // truss posts
    }
  }
  const diagLen = Math.hypot(step, 0.03);
  for (let i = 0; i < nBay; i++) {
    const zm = -DECK_L / 2 + (i + 0.5) * step;
    const dir = i % 2 === 0 ? 1 : -1;
    for (const sx of [-0.06, 0.06]) {
      const d = new THREE.BoxGeometry(0.005, diagLen, 0.005);
      d.rotateX(Math.atan2(dir * step, 0.03));
      d.translate(sx, 0.3745, zm);
      deckParts.push(d); // truss diagonals
    }
  }

  // -- main cables: full catenary sweep, tower top to anchorage ------------
  const cableParts: THREE.BufferGeometry[] = [];
  const mainCurves: THREE.QuadraticBezierCurve3[] = [];
  const sideCurves: THREE.QuadraticBezierCurve3[] = [];
  for (const sx of [-LEG_X, LEG_X]) {
    const main = mainCableCurve(sx);
    mainCurves.push(main);
    cableParts.push(new THREE.TubeGeometry(main, 28, 0.011, 6, false));
    for (const sz of [-1, 1]) {
      const side = sideCableCurve(sx, sz);
      sideCurves.push(side);
      cableParts.push(new THREE.TubeGeometry(side, 12, 0.0095, 6, false));
    }
  }

  // -- suspender rods (one merged mesh) -------------------------------------
  const rodParts: THREE.BufferGeometry[] = [];
  const rod = (x: number, yTop: number, z: number) => {
    const h = yTop - DECK_TOP;
    if (h < 0.035) return;
    const g = new THREE.CylinderGeometry(0.0033, 0.0033, h, 4);
    g.translate(x, DECK_TOP + h / 2, z);
    rodParts.push(g);
  };
  for (const curve of mainCurves) {
    for (let i = 1; i < 14; i++) {
      const p = curve.getPoint(i / 14);
      rod(p.x, p.y, p.z);
    }
  }
  for (const curve of sideCurves) {
    for (const t of [0.25, 0.5, 0.75]) {
      const p = curve.getPoint(t);
      rod(p.x, p.y, p.z);
    }
  }

  return {
    towers: mergeGeometries(towerParts),
    deck: mergeGeometries(deckParts),
    cables: mergeGeometries(cableParts),
    rods: mergeGeometries(rodParts),
  };
}

export default function GoldenGate({ data }: { data: TerrainData }) {
  const pos = useMemo<V3>(() => {
    const [x, z] = lngLatToScene(data.meta, -122.4783, 37.8199);
    return [x, 0, z];
  }, [data]);

  const geo = useMemo(() => buildBridge(), []);

  return (
    <group position={pos} scale={1.1}>
      <mesh geometry={geo.towers}>
        <meshStandardMaterial color={ORANGE} roughness={0.55} emissive={ORANGE} emissiveIntensity={0.3} />
      </mesh>
      <mesh geometry={geo.deck}>
        <meshStandardMaterial color={ORANGE_DEEP} roughness={0.7} emissive={ORANGE_DEEP} emissiveIntensity={0.28} />
      </mesh>
      <mesh geometry={geo.cables}>
        <meshStandardMaterial color={ORANGE} roughness={0.6} emissive={ORANGE} emissiveIntensity={0.32} />
      </mesh>
      <mesh geometry={geo.rods}>
        <meshStandardMaterial color={ORANGE} roughness={0.6} emissive={ORANGE} emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}
