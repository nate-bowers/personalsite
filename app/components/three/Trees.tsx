"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  elevationAtScene,
  lngLatToScene,
  openWaterAtScene,
  type TerrainData,
} from "@/lib/terrain";

// keep clearings around the landmarks so they read instantly
const CLEARINGS: [number, number, number][] = [
  [-122.1661, 37.4275, 0.55], // Hoover Tower
  [-122.2578, 37.8721, 0.55], // Campanile
  [-121.9696, 37.4033, 0.95], // Levi's Stadium (rectangular footprint)
  [-122.4783, 37.8199, 0.9], // Golden Gate approaches (full span)
];

/**
 * Land cover, coastal greens only (FIX 3b): two species, one InstancedMesh
 * each — two draw calls for the whole forest.
 *
 *  - Conifers: dense dark coverage on the Marin ridges and the Big Sur coast,
 *    holding steep and high terrain elsewhere (where the albedo also goes
 *    green), sparse singles in the grassland.
 *  - Monterey cypress: scattered along the immediate coastline, windswept
 *    silhouette.
 *
 * Placement is sampled from the real heightmap (elevation, slope, distance to
 * water) with a seeded RNG so the forest is stable across renders.
 */

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Tiered conifer (~40 tris): trunk + two stacked cones.
function coniferGeometry(): THREE.BufferGeometry {
  const trunk = new THREE.CylinderGeometry(0.012, 0.016, 0.07, 5);
  trunk.translate(0, 0.035, 0);
  const lower = new THREE.ConeGeometry(0.075, 0.2, 7);
  lower.translate(0, 0.14, 0);
  const upper = new THREE.ConeGeometry(0.05, 0.16, 7);
  upper.translate(0, 0.27, 0);
  return mergeGeometries([trunk, lower, upper]);
}

// Windswept Monterey cypress (~50 tris): leaning trunk + flattened canopy.
function cypressGeometry(): THREE.BufferGeometry {
  const trunk = new THREE.CylinderGeometry(0.012, 0.018, 0.12, 5);
  trunk.translate(0, 0.06, 0);
  trunk.rotateZ(0.18); // leaning away from the onshore wind
  const canopy = new THREE.SphereGeometry(0.07, 7, 5);
  canopy.scale(1.5, 0.55, 1.2);
  canopy.translate(0.025, 0.15, 0);
  return mergeGeometries([trunk, canopy]);
}

interface Instance {
  pos: [number, number, number];
  scale: number;
  rotY: number;
  color: THREE.Color;
}

function buildForest(data: TerrainData) {
  const rng = mulberry32(20260611);
  const { meta } = data;
  const halfW = meta.sceneWidth / 2;
  const halfD = meta.sceneDepth / 2;

  // region boosts in real coordinates
  const [, marinZ] = lngLatToScene(meta, -122.6, 37.82); // north of the gate
  const [bigSurX, bigSurZ] = lngLatToScene(meta, -121.9, 36.6);

  const clearings = CLEARINGS.map(([lng, lat, r]) => {
    const [cx, cz] = lngLatToScene(meta, lng, lat);
    return [cx, cz, r] as [number, number, number];
  });
  const inClearing = (x: number, z: number) =>
    clearings.some(([cx, cz, r]) => (x - cx) * (x - cx) + (z - cz) * (z - cz) < r * r);

  const conifers: Instance[] = [];
  const cypress: Instance[] = [];
  const c = new THREE.Color();

  let tries = 0;
  while (conifers.length < 2600 && tries < 220000) {
    tries++;
    const x = (rng() * 2 - 1) * halfW;
    const z = (rng() * 2 - 1) * halfD;
    const elev = elevationAtScene(data, x, z);
    if (elev < 6 || elev > 1100) continue;
    if (inClearing(x, z)) continue;

    const e = 0.12;
    const slope =
      (Math.abs(elevationAtScene(data, x + e, z) - elevationAtScene(data, x - e, z)) +
        Math.abs(elevationAtScene(data, x, z + e) - elevationAtScene(data, x, z - e))) /
      (2 * e) /
      900; // rough normalized gradient

    const nearOcean = openWaterAtScene(data, x - 0.25, z) > 0.15 || openWaterAtScene(data, x, z + 0.25) > 0.15;
    const marin = z < marinZ && !nearOcean;
    const bigSur = z > bigSurZ && x > bigSurX - 2.5;

    // base acceptance: forests hold steep + high ground
    let p = 0.04; // sparse grassland singles
    if (slope > 0.25 || elev > 320) p = 0.55;
    if (marin) p *= 2.2;
    if (bigSur) p *= 2.4;
    if (nearOcean && elev < 40) p *= 0.25; // beaches stay open
    if (rng() > p) continue;

    c.setHSL(0.31 + rng() * 0.07, 0.32 + rng() * 0.18, 0.16 + rng() * 0.12);
    conifers.push({
      pos: [x, elev * meta.yScale, z],
      scale: 0.55 + rng() * 0.8,
      rotY: rng() * Math.PI * 2,
      color: c.clone(),
    });
  }

  tries = 0;
  while (cypress.length < 240 && tries < 60000) {
    tries++;
    const x = (rng() * 2 - 1) * halfW;
    const z = (rng() * 2 - 1) * halfD;
    const elev = elevationAtScene(data, x, z);
    if (elev < 4 || elev > 90) continue;
    // immediate coastline: open water close by to the west or south
    const coastal =
      openWaterAtScene(data, x - 0.18, z) > 0.25 || openWaterAtScene(data, x, z + 0.18) > 0.25;
    if (!coastal || rng() > 0.5) continue;
    c.setHSL(0.34 + rng() * 0.04, 0.26 + rng() * 0.12, 0.14 + rng() * 0.08);
    cypress.push({
      pos: [x, elev * meta.yScale, z],
      scale: 0.6 + rng() * 0.7,
      rotY: rng() * Math.PI * 2,
      color: c.clone(),
    });
  }

  return { conifers, cypress };
}

function Species({
  geometry,
  instances,
}: {
  geometry: THREE.BufferGeometry;
  instances: Instance[];
}) {
  const ref = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    const axis = new THREE.Vector3(0, 1, 0);
    instances.forEach((t, i) => {
      p.set(t.pos[0], t.pos[1], t.pos[2]);
      q.setFromAxisAngle(axis, t.rotY);
      s.set(t.scale, t.scale, t.scale);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, t.color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [instances]);

  return (
    <instancedMesh ref={ref} args={[geometry, undefined, instances.length]}>
      <meshStandardMaterial color="#ffffff" roughness={1} metalness={0} />
    </instancedMesh>
  );
}

export default function Trees({ data }: { data: TerrainData }) {
  const coniferGeo = useMemo(() => coniferGeometry(), []);
  const cypressGeo = useMemo(() => cypressGeometry(), []);
  const { conifers, cypress } = useMemo(() => buildForest(data), [data]);

  return (
    <group>
      <Species geometry={coniferGeo} instances={conifers} />
      <Species geometry={cypressGeo} instances={cypress} />
    </group>
  );
}
