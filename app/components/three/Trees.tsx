"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { sampleElevation, type TerrainData } from "@/lib/terrain";
import { POND_X, POND_Z } from "./Pond";

// deterministic RNG so the forest is stable across renders
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

// A tiered fir: a short trunk + three stacked cones, merged into one geometry so the
// whole forest is a single instanced draw call.
function makeTreeGeometry(): THREE.BufferGeometry {
  const cone = (r: number, h: number, y: number) => {
    const g = new THREE.ConeGeometry(r, h, 7);
    g.translate(0, y, 0);
    return g;
  };
  const trunk = new THREE.CylinderGeometry(0.02, 0.028, 0.12, 6);
  trunk.translate(0, 0.06, 0);
  return mergeGeometries([
    trunk,
    cone(0.13, 0.3, 0.18),
    cone(0.1, 0.26, 0.34),
    cone(0.07, 0.22, 0.48),
  ]);
}

export default function Trees({ data }: { data: TerrainData }) {
  const geometry = useMemo(() => makeTreeGeometry(), []);
  const ref = useRef<THREE.InstancedMesh>(null);

  const trees = useMemo(() => {
    const rng = mulberry32(20260611);
    const { meta } = data;
    const halfW = meta.sceneWidth / 2 - 0.4;
    const halfD = meta.sceneDepth / 2 - 0.4;
    const out: { pos: [number, number, number]; scale: number; color: THREE.Color }[] = [];
    const c = new THREE.Color();
    let tries = 0;
    while (out.length < 520 && tries < 60000) {
      tries++;
      const x = (rng() * 2 - 1) * halfW;
      const z = (rng() * 2 - 1) * halfD;
      const u = (x + meta.sceneWidth / 2) / meta.sceneWidth;
      const v = (z + meta.sceneDepth / 2) / meta.sceneDepth;
      const elev = sampleElevation(data, u * (meta.width - 1), v * (meta.height - 1));
      if (elev < 14 || elev > 850) continue;
      if (x < -1.0 && elev < 55) continue; // keep the Pacific shore clear of trees
      // leave an open clearing around the pond
      const pdx = x - POND_X;
      const pdz = z - POND_Z;
      if (pdx * pdx + pdz * pdz < 1.15 * 1.15) continue;
      // sparse & scattered: thin out further inland so the land reads as open hills
      // dotted with trees rather than a solid canopy
      const inland = THREE.MathUtils.clamp((x + 1.5) / 6.0, 0, 1);
      if (rng() < 0.2 + 0.45 * inland) continue;
      const scale = 0.5 + rng() * 1.05;
      const r = rng();
      if (r < 0.7) {
        c.setHSL(0.26 + rng() * 0.06, 0.5, 0.27 + rng() * 0.1); // greens
      } else if (r < 0.88) {
        c.setHSL(0.07 + rng() * 0.05, 0.65, 0.44 + rng() * 0.08); // autumn gold/orange
      } else {
        c.setHSL(0.02 + rng() * 0.03, 0.64, 0.42 + rng() * 0.06); // autumn red
      }
      out.push({ pos: [x, elev * meta.yScale, z], scale, color: c.clone() });
    }
    return out;
  }, [data]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    trees.forEach((t, i) => {
      p.set(t.pos[0], t.pos[1], t.pos[2]);
      s.set(t.scale, t.scale, t.scale);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, t.color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [trees]);

  return (
    <instancedMesh ref={ref} args={[geometry, undefined, trees.length]} castShadow receiveShadow>
      <meshStandardMaterial color="#ffffff" roughness={1} metalness={0} />
    </instancedMesh>
  );
}
