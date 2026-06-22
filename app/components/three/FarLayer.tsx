"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useQuality } from "@/lib/quality";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  farElevationAtScene,
  sampleElevation,
  lngLatToScene,
  type TerrainData,
  type FarData,
} from "@/lib/terrain";
import { TOKENS } from "./atmosphere";
import { albedo, terrainVertexShader, terrainFragmentShader } from "./Terrain";

/**
 * The secondary topography tier: real z8 elevation for the California around
 * the core bbox (Clear Lake down past Paso Robles, the Pacific to the Sierra
 * foothills), so the land continues naturally out to the fog wall instead of
 * collapsing to a synthetic plain. Loaded lazily AFTER the scene is up — this
 * whole layer is decoration and must never touch the initial load.
 *
 * Inside the core bbox the far mesh tucks 0.05 units below the hi-res terrain;
 * a 1.4-unit feather outside the boundary blends from the core's edge values
 * into the far data so there is no visible seam. The far tier's own outer
 * edge gets the same neutralization as the old skirt (flat plain, flat
 * normals, haze albedo) — but it now sits 35+ units out, behind the fog.
 */

const SEG = 150;

// Haze bake for the far-tier trees, referenced from the near-fixed home camera
// (same approach as Trees.tsx) so distant trees dissolve into the atmosphere.
const HAZE = new THREE.Color(TOKENS.fog);
const HOME_X = -11;
const HOME_Z = 7;
const FEATHER = 1.4; // units outside the core bbox blended core-edge -> far
const OUTER_COLLAPSE = 3; // units inside the far edge collapsing to haze plain

function FarTerrain({
  data,
  far,
  sunDir,
}: {
  data: TerrainData;
  far: FarData;
  sunDir: [number, number, number];
}) {
  const quality = useQuality();
  const geometry = useMemo(() => {
    const seg = quality === "calm" ? 90 : SEG;
    const { meta } = data;
    const halfW = meta.sceneWidth / 2;
    const halfD = meta.sceneDepth / 2;
    const [fx0, fz0] = lngLatToScene(meta, meta.far.bbox.lngMin, meta.far.bbox.latMax);
    const [fx1, fz1] = lngLatToScene(meta, meta.far.bbox.lngMax, meta.far.bbox.latMin);

    const geo = new THREE.PlaneGeometry(1, 1, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;

    const elevs = new Float32Array(pos.count);
    const hazeT = new Float32Array(pos.count);
    // far-grid footprint averaging (the mesh is ~3x coarser than the far grid;
    // single taps would moiré on the distant ridges)
    const fpx = ((fx1 - fx0) / seg) * 0.33;
    const farAvg = (x: number, z: number) =>
      (farElevationAtScene(far, x - fpx, z) +
        farElevationAtScene(far, x + fpx, z) +
        farElevationAtScene(far, x, z - fpx) +
        farElevationAtScene(far, x, z + fpx) +
        farElevationAtScene(far, x, z)) /
      5;

    for (let i = 0; i < pos.count; i++) {
      const tx = pos.getX(i) + 0.5;
      const tz = pos.getZ(i) + 0.5;
      const x = fx0 + tx * (fx1 - fx0);
      const z = fz0 + tz * (fz1 - fz0);

      const inX = Math.abs(x) <= halfW;
      const inZ = Math.abs(z) <= halfD;
      let elev: number;
      let sink = 0;

      if (inX && inZ) {
        // under the hi-res core mesh: follow it from below, never poke through
        const u = (x + halfW) / meta.sceneWidth;
        const v = (z + halfD) / meta.sceneDepth;
        elev = sampleElevation(data, u * (meta.width - 1), v * (meta.height - 1));
        sink = 0.05;
      } else {
        const dOut = Math.hypot(
          Math.max(0, Math.abs(x) - halfW),
          Math.max(0, Math.abs(z) - halfD),
        );
        elev = farAvg(x, z);
        if (dOut < FEATHER) {
          // feather: start from the exact edge value the core mesh renders
          const cu = THREE.MathUtils.clamp((x + halfW) / meta.sceneWidth, 0, 1);
          const cv = THREE.MathUtils.clamp((z + halfD) / meta.sceneDepth, 0, 1);
          const edge = sampleElevation(data, cu * (meta.width - 1), cv * (meta.height - 1));
          const t = THREE.MathUtils.smoothstep(dOut, 0, FEATHER);
          elev = edge * (1 - t) + elev * t;
        }
      }

      // the far tier's own outer boundary collapses to a haze plain (it sits
      // 35+ units out, at/behind the fog wall)
      const edgeDist = Math.min(x - fx0, fx1 - x, z - fz0, fz1 - z);
      const collapse = 1 - THREE.MathUtils.smoothstep(edgeDist, 0, OUTER_COLLAPSE);
      if (collapse > 0 && elev > 2.5) elev = elev * (1 - collapse) + 2.5 * collapse;
      hazeT[i] = collapse;

      elevs[i] = elev;
      pos.setXYZ(i, x, elev * meta.yScale - sink, z);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();

    // flatten normals + haze the albedo at the outer collapse (same artifact
    // class as the old skirt: end-on sunlit faces read as bright walls)
    const normals = geo.attributes.normal as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const tmp = new THREE.Color();
    const haze = new THREE.Color(TOKENS.fog).multiplyScalar(0.45);
    for (let i = 0; i < pos.count; i++) {
      const t = hazeT[i];
      if (t > 0) {
        const nx = normals.getX(i) * (1 - t);
        const ny = normals.getY(i) * (1 - t) + t;
        const nz = normals.getZ(i) * (1 - t);
        const m = Math.hypot(nx, ny, nz) || 1;
        normals.setXYZ(i, nx / m, ny / m, nz / m);
      }
      const slope = 1 - normals.getY(i);
      albedo(elevs[i], slope, tmp);
      if (t > 0) tmp.lerp(haze, t * 0.9);
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
    normals.needsUpdate = true;
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [data, far, quality]);

  const uniforms = useMemo(
    () => ({
      uSunDir: { value: new THREE.Vector3(...sunDir) },
      uSunGlow: { value: new THREE.Color(TOKENS.sunGlow) },
      uLandShade: { value: new THREE.Color(TOKENS.landShade) },
    }),
    [sunDir],
  );

  return (
    <mesh geometry={geometry}>
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={terrainVertexShader}
        fragmentShader={terrainFragmentShader}
        vertexColors
      />
    </mesh>
  );
}

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

/** Sparse instanced conifers on the far ridges — one draw call. */
function FarTrees({ data, far }: { data: TerrainData; far: FarData }) {
  const quality = useQuality();
  const geometry = useMemo(() => {
    const trunk = new THREE.CylinderGeometry(0.014, 0.02, 0.08, 5);
    trunk.translate(0, 0.04, 0);
    const lower = new THREE.ConeGeometry(0.09, 0.24, 6);
    lower.translate(0, 0.17, 0);
    const upper = new THREE.ConeGeometry(0.06, 0.18, 6);
    upper.translate(0, 0.32, 0);
    return mergeGeometries([trunk, lower, upper]);
  }, []);

  const instances = useMemo(() => {
    const { meta } = data;
    const halfW = meta.sceneWidth / 2;
    const halfD = meta.sceneDepth / 2;
    const [fx0, fz0] = lngLatToScene(meta, meta.far.bbox.lngMin, meta.far.bbox.latMax);
    const [fx1, fz1] = lngLatToScene(meta, meta.far.bbox.lngMax, meta.far.bbox.latMin);
    const rng = mulberry32(46012);
    const out: { pos: [number, number, number]; scale: number; color: THREE.Color }[] = [];
    const c = new THREE.Color();
    const target = quality === "calm" ? 1150 : 2300;
    let tries = 0;
    while (out.length < target && tries < 160000) {
      tries++;
      const x = fx0 + rng() * (fx1 - fx0);
      const z = fz0 + rng() * (fz1 - fz0);
      // far tier only — the core has its own forest
      if (Math.abs(x) < halfW + 0.3 && Math.abs(z) < halfD + 0.3) continue;
      // stay clear of the hazed outer collapse
      if (Math.min(x - fx0, fx1 - x, z - fz0, fz1 - z) < OUTER_COLLAPSE + 1) continue;
      const elev = farElevationAtScene(far, x, z);
      if (elev < 110 || elev > 1350) continue;
      if (rng() < 0.45) continue;
      c.setHSL(0.33 + rng() * 0.05, 0.22 + rng() * 0.12, 0.14 + rng() * 0.08);
      // far-tier trees live well past the core; bake heavy haze into them so
      // they read as a soft tree-line dissolving into the atmosphere, never
      // crisp dark dots on the faded ridges
      const d = Math.hypot(x - HOME_X, z - HOME_Z);
      c.lerp(HAZE, THREE.MathUtils.clamp((d - 16) / 18, 0, 1) * 0.9);
      out.push({
        pos: [x, elev * meta.yScale, z],
        scale: 0.8 + rng() * 0.9,
        color: c.clone(),
      });
    }
    return out;
  }, [data, far, quality]);

  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    instances.forEach((t, i) => {
      p.set(t.pos[0], t.pos[1], t.pos[2]);
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


// Central Valley farmland: a quilt of flat field quads on the valley floor —
// one InstancedMesh. Their warm crop/fallow tones are what makes the flat,
// fog-washed plain east of the bay read as LAND instead of distant water.
const FIELD_COLORS = ["#c8ab47", "#5f8a3e", "#96713f", "#a8b052", "#d3b65e", "#4e7c3a"];

function FarmFields({ data, far }: { data: TerrainData; far: FarData }) {
  const quality = useQuality();
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);

  const fields = useMemo(() => {
    const { meta } = data;
    const halfW = meta.sceneWidth / 2;
    const halfD = meta.sceneDepth / 2;
    const coreElev = (x: number, z: number) => {
      const u = (x + halfW) / meta.sceneWidth;
      const v = (z + halfD) / meta.sceneDepth;
      return sampleElevation(data, u * (meta.width - 1), v * (meta.height - 1));
    };
    const ground = (x: number, z: number) =>
      Math.abs(x) <= halfW && Math.abs(z) <= halfD ? coreElev(x, z) : farElevationAtScene(far, x, z);

    const rng = mulberry32(95202);
    const out: { pos: [number, number, number]; sx: number; sz: number; rotY: number; color: THREE.Color }[] = [];
    const c = new THREE.Color();
    // jittered grid over the valley: dried Suisun/Delta flats through the
    // San Joaquin, east of the Diablo ridge, fading before the foothills.
    // calm coarsens the grid (~½ the fields) so Tier B is a real GPU lever here.
    const stepX = quality === "calm" ? 0.93 : 0.62;
    const stepZ = quality === "calm" ? 0.69 : 0.46;
    for (let gx = 6.4; gx < 27; gx += stepX) {
      for (let gz = -19; gz < 9; gz += stepZ) {
        const x = gx + (rng() - 0.5) * 0.3;
        const z = gz + (rng() - 0.5) * 0.24;
        const e = ground(x, z);
        if (e < 3.5 || e > 90) continue; // valley floor only
        // flat ground only — no fields climbing the hillsides
        const slope =
          Math.abs(ground(x + 0.3, z) - e) + Math.abs(ground(x, z + 0.3) - e);
        if (slope > 14) continue;
        if (rng() < 0.18) continue; // gaps in the quilt
        c.set(FIELD_COLORS[Math.floor(rng() * FIELD_COLORS.length)]);
        c.offsetHSL(0, (rng() - 0.5) * 0.06, (rng() - 0.5) * 0.05);
        out.push({
          pos: [x, e * meta.yScale + 0.006, z],
          sx: 0.5 + rng() * 0.34,
          sz: 0.36 + rng() * 0.26,
          rotY: -0.32 + (rng() - 0.5) * 0.16, // loosely aligned to the valley axis
          color: c.clone(),
        });
      }
    }
    return out;
  }, [data, far, quality]);

  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    const axis = new THREE.Vector3(0, 1, 0);
    fields.forEach((t, i) => {
      p.set(t.pos[0], t.pos[1], t.pos[2]);
      q.setFromAxisAngle(axis, t.rotY);
      s.set(t.sx, 1, t.sz);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, t.color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [fields]);

  return (
    <instancedMesh ref={ref} args={[geometry, undefined, fields.length]}>
      <meshStandardMaterial color="#ffffff" roughness={1} metalness={0} />
    </instancedMesh>
  );
}

// Highway 101, SF to Paso Robles — real waypoints, draped on whichever tier
// owns the ground beneath it.
const US101: [number, number][] = [
  [-122.41, 37.78],
  [-122.4, 37.68],
  [-122.31, 37.55],
  [-122.14, 37.43],
  [-121.89, 37.33],
  [-121.65, 37.13],
  [-121.57, 37.0],
  [-121.67, 36.79],
  [-121.66, 36.68],
  [-121.24, 36.32],
  [-121.13, 36.21],
  [-120.9, 35.99],
  [-120.69, 35.63],
];

function Highway({ data, far }: { data: TerrainData; far: FarData }) {
  const quality = useQuality();
  const geometry = useMemo(() => {
    const { meta } = data;
    const halfW = meta.sceneWidth / 2;
    const halfD = meta.sceneDepth / 2;
    // Sample the surface the terrain MESHES actually render (footprint
    // averaged), not the raw heightmap — a bilinear-draped ribbon submerges
    // on slopes where the averaged mesh sits higher.
    const coreFpPx = ((meta.width - 1) / (240 * 0.7)) * 0.5; // matches Terrain.tsx SEG/CORE
    const coreAt = (x: number, z: number) => {
      const gx = ((x + halfW) / meta.sceneWidth) * (meta.width - 1);
      const gz = ((z + halfD) / meta.sceneDepth) * (meta.height - 1);
      let sum = 0;
      for (let oz = -1; oz <= 1; oz++)
        for (let ox = -1; ox <= 1; ox++) sum += sampleElevation(data, gx + ox * coreFpPx, gz + oz * coreFpPx);
      return sum / 9;
    };
    const [gx0] = lngLatToScene(meta, meta.far.bbox.lngMin, meta.far.bbox.latMax);
    const [gx1] = lngLatToScene(meta, meta.far.bbox.lngMax, meta.far.bbox.latMin);
    const farFp = ((gx1 - gx0) / SEG) * 0.33;
    const farAt = (x: number, z: number) =>
      (farElevationAtScene(far, x - farFp, z) +
        farElevationAtScene(far, x + farFp, z) +
        farElevationAtScene(far, x, z - farFp) +
        farElevationAtScene(far, x, z + farFp) +
        farElevationAtScene(far, x, z)) / 5;
    const groundAt = (x: number, z: number) =>
      Math.abs(x) <= halfW && Math.abs(z) <= halfD ? coreAt(x, z) : farAt(x, z);

    const pts = US101.map(([lng, lat]) => {
      const [x, z] = lngLatToScene(meta, lng, lat);
      return new THREE.Vector3(x, 0, z);
    });
    const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.4);
    const N = quality === "calm" ? 240 : 420;
    const HALF_W = 0.038;
    const verts = new Float32Array((N + 1) * 2 * 3);
    const idx: number[] = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const p = curve.getPoint(t);
      const tan = curve.getTangent(t);
      // perpendicular in the ground plane
      const px = -tan.z;
      const pz = tan.x;
      const m = Math.hypot(px, pz) || 1;
      const lx = p.x + (px / m) * HALF_W;
      const lz = p.z + (pz / m) * HALF_W;
      const rx = p.x - (px / m) * HALF_W;
      const rz = p.z - (pz / m) * HALF_W;
      verts[(i * 2) * 3] = lx;
      verts[(i * 2) * 3 + 1] = groundAt(lx, lz) * meta.yScale + 0.026;
      verts[(i * 2) * 3 + 2] = lz;
      verts[(i * 2 + 1) * 3] = rx;
      verts[(i * 2 + 1) * 3 + 1] = groundAt(rx, rz) * meta.yScale + 0.026;
      verts[(i * 2 + 1) * 3 + 2] = rz;
      if (i < N) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(verts, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }, [data, far, quality]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#453f50" roughness={1} metalness={0} />
    </mesh>
  );
}

export default function FarLayer({
  data,
  far,
  sunDir,
}: {
  data: TerrainData;
  far: FarData;
  sunDir: [number, number, number];
}) {
  return (
    <group>
      <FarTerrain data={data} far={far} sunDir={sunDir} />
      <FarTrees data={data} far={far} />
      <FarmFields data={data} far={far} />
      <Highway data={data} far={far} />
    </group>
  );
}
