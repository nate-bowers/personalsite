"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { sampleElevation, type TerrainData } from "@/lib/terrain";

/**
 * Terrain mesh. Within the real heightmap bbox it uses the elevation data; BEYOND it
 * the surface is continued procedurally — the ocean deepens westward, and the inland
 * (east/north/south) rolls on as gentle hills out to the horizon. So the scene reads
 * as a coastline (ocean on the Pacific side, land to the horizon inland) rather than
 * an island floating in water.
 */

const RAMP: [number, THREE.Color][] = [
  [-200, new THREE.Color("#c2ac82")],
  [3, new THREE.Color("#e3d3a4")], // beach sand
  [22, new THREE.Color("#b7c476")], // coastal scrub
  [90, new THREE.Color("#86ab5d")], // green hills
  [280, new THREE.Color("#6e9651")], // forest
  [620, new THREE.Color("#a9ab66")], // high grassland (golden)
  [980, new THREE.Color("#c6a972")], // rock
  [1500, new THREE.Color("#d8b585")], // peaks
];

function colorForElevation(elev: number, out: THREE.Color) {
  if (elev <= RAMP[0][0]) return out.copy(RAMP[0][1]);
  for (let i = 1; i < RAMP.length; i++) {
    if (elev <= RAMP[i][0]) {
      const [e0, c0] = RAMP[i - 1];
      const [e1, c1] = RAMP[i];
      return out.copy(c0).lerp(c1, (elev - e0) / (e1 - e0));
    }
  }
  return out.copy(RAMP[RAMP.length - 1][1]);
}

const EXT = 3.2; // how far the plane extends beyond the bbox (to reach the horizon)
const SEG = 320;

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export default function Terrain({ data }: { data: TerrainData }) {
  const geometry = useMemo(() => {
    const { meta } = data;
    const halfW = meta.sceneWidth / 2;
    const halfD = meta.sceneDepth / 2;
    const geo = new THREE.PlaneGeometry(meta.sceneWidth * EXT, meta.sceneDepth * EXT, SEG, SEG);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const tmp = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const u = (x + halfW) / meta.sceneWidth;
      const v = (z + halfD) / meta.sceneDepth;

      let elev: number;
      if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
        // inside the real bbox
        elev = sampleElevation(data, u * (meta.width - 1), v * (meta.height - 1));
      } else {
        // outside: continue the nearest edge value
        const cu = THREE.MathUtils.clamp(u, 0, 1);
        const cv = THREE.MathUtils.clamp(v, 0, 1);
        const edge = sampleElevation(data, cu * (meta.width - 1), cv * (meta.height - 1));
        const outU = Math.max(0, -u, u - 1);
        const outV = Math.max(0, -v, v - 1);
        const distOut = Math.max(outU, outV) * meta.sceneWidth;
        if (edge < 15) {
          // ocean edge -> open ocean, deepening outward
          elev = Math.min(edge, -40) - distOut * 10;
        } else {
          // inland -> gentle rolling hills out to the horizon
          const hills =
            Math.sin(x * 0.5) * Math.cos(z * 0.42) +
            Math.sin(x * 0.9 + z * 0.55 + 1.1) * 0.55 +
            Math.sin(z * 1.2 - x * 0.3) * 0.35;
          const fade = smoothstep(0, 2.0, distOut);
          elev = edge + (hills * 95 + 55) * fade;
        }
      }

      pos.setY(i, elev * meta.yScale);
      colorForElevation(elev, tmp);
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }

    pos.needsUpdate = true;
    geo.computeVertexNormals();
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [data]);

  return (
    <mesh geometry={geometry} receiveShadow castShadow>
      <meshStandardMaterial vertexColors roughness={1} metalness={0} />
    </mesh>
  );
}
