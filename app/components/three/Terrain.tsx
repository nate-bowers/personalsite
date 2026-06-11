"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { sampleElevation, type TerrainData } from "@/lib/terrain";
import { TOKENS, HEIGHT_FOG_GLSL } from "./atmosphere";

/**
 * The coastline terrain. One mesh, one draw call: a grid whose vertex density
 * is warped — ~70% of the vertices cover the real heightmap bbox (so the Golden
 * Gate strait survives), the rest stretch out to ±~40 scene units where the
 * height fog has long since gone opaque. No terrain edge can be seen from any
 * camera; the geometry simply continues past the fog wall.
 *
 * Albedo is graded on the CPU by elevation AND slope (DESIGN-PHASE2.md §1 /
 * FIX 3a): sand at the waterline, golden grass on the low rolling hills, dark
 * conifer green on steep and high terrain. Lighting is a custom golden-hour
 * shader: faces lit by the low western sun in --land-lit warmth, shaded faces
 * falling toward --land-shade violet, warm rim light on the ridgelines.
 */

const SEG = 280;
const CORE = 0.7; // fraction of grid parameter covering the heightmap bbox
const EDGE_X = 58; // absolute skirt extent (scene units) — past full-fog from every camera
const EDGE_Z = 62;

// elevation (m) -> base albedo
const RAMP: [number, THREE.Color][] = [
  [-160, new THREE.Color("#1c3148")], // seafloor (only visible through troughs)
  [-4, new THREE.Color("#2e4a5c")],
  [1, new THREE.Color("#decdA0")], // sand strip at the waterline
  [14, new THREE.Color("#d3bc82")],
  [60, new THREE.Color("#c2a45e")], // golden grass, low rolling hills
  [260, new THREE.Color("#a3914f")], // drier gold higher up
  [520, new THREE.Color("#6f7d44")], // grass -> brush transition
  [950, new THREE.Color("#5b6b40")],
  [1500, new THREE.Color("#8d8268")], // high rock
];

const STEEP = new THREE.Color("#41633f"); // conifer dark green (steep faces)
const HIGH_FOREST = new THREE.Color("#3c5a3d");

function albedo(elev: number, slope: number, out: THREE.Color) {
  // base by elevation
  if (elev <= RAMP[0][0]) out.copy(RAMP[0][1]);
  else {
    out.copy(RAMP[RAMP.length - 1][1]);
    for (let i = 1; i < RAMP.length; i++) {
      if (elev <= RAMP[i][0]) {
        const [e0, c0] = RAMP[i - 1];
        const [e1, c1] = RAMP[i];
        out.copy(c0).lerp(c1, (elev - e0) / (e1 - e0));
        break;
      }
    }
  }
  if (elev > 8) {
    // steep faces and high terrain go dark green (forest holds the slopes)
    const steepT = THREE.MathUtils.smoothstep(slope, 0.3, 0.62);
    const highT = THREE.MathUtils.smoothstep(elev, 320, 700) * 0.75;
    out.lerp(STEEP, steepT * 0.8);
    out.lerp(HIGH_FOREST, Math.max(0, highT - steepT * 0.3));
  }
  return out;
}

// grid parameter t (0..1) -> world coord: linear across the bbox core,
// quadratically stretched skirt outside it
function warp(t: number, half: number, edge: number) {
  const u = (t - 0.5) * 2; // -1..1
  const a = Math.abs(u);
  if (a <= CORE) return (u / CORE) * half;
  const s = (a - CORE) / (1 - CORE);
  return Math.sign(u) * (half + s * s * (edge - half));
}

const vertexShader = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec3 vColor;
  void main() {
    vColor = color;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPos = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uSunDir;
  uniform vec3 uSunGlow;
  uniform vec3 uLandShade;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec3 vColor;

  ${HEIGHT_FOG_GLSL}

  void main() {
    vec3 N = normalize(vNormal);
    vec3 S = normalize(uSunDir);
    vec3 V = normalize(cameraPosition - vWorldPos);
    float lambert = max(dot(N, S), 0.0);

    // golden-hour grade: lit faces warm toward --land-lit, shaded faces fall
    // toward --land-shade violet (the painterly two-sided Firewatch read)
    vec3 lit = vColor * vec3(1.32, 1.04, 0.74) * (0.55 + 0.85 * lambert);
    vec3 shade = mix(vColor, uLandShade, 0.55) * 0.52;
    vec3 col = mix(shade, lit, smoothstep(0.0, 0.5, lambert));

    // warm rim light on ridgelines facing the low sun
    float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0) * lambert;
    col += uSunGlow * rim * 0.22;

    float dist = length(cameraPosition - vWorldPos);
    col = applyHeightFog(col, dist, vWorldPos.y);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export default function Terrain({
  data,
  sunDir,
}: {
  data: TerrainData;
  sunDir: [number, number, number];
}) {
  const geometry = useMemo(() => {
    const { meta } = data;
    const halfW = meta.sceneWidth / 2;
    const halfD = meta.sceneDepth / 2;

    const geo = new THREE.PlaneGeometry(1, 1, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;

    // elevations + skirt factor cached per vertex for the color pass
    const elevs = new Float32Array(pos.count);
    const skirtT = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      // PlaneGeometry(1,1) gives x,z in -0.5..0.5 -> grid parameter 0..1
      const tx = pos.getX(i) + 0.5;
      const tz = pos.getZ(i) + 0.5;
      const x = warp(tx, halfW, EDGE_X);
      const z = warp(tz, halfD, EDGE_Z);

      const u = (x + halfW) / meta.sceneWidth;
      const v = (z + halfD) / meta.sceneDepth;
      let elev: number;
      if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
        // Band-limited sampling: the mesh grid is coarser than the heightmap,
        // so a single bilinear tap aliases into moiré "corduroy" stripes on
        // steep slopes. Average a 3x3 footprint matched to the vertex spacing
        // instead — band-limit at the actual sampling rate.
        const gx = u * (meta.width - 1);
        const gz = v * (meta.height - 1);
        const fp = ((meta.width - 1) / (SEG * CORE)) * 0.5; // half vertex spacing in px
        let sum = 0;
        for (let oz = -1; oz <= 1; oz++) {
          for (let ox = -1; ox <= 1; ox++) {
            sum += sampleElevation(data, gx + ox * fp, gz + oz * fp);
          }
        }
        elev = sum / 9;
      } else {
        // skirt: continue the edge value; ocean edges deepen, land edges roll
        // out as low hills — all of it lives behind the fog wall anyway
        const cu = THREE.MathUtils.clamp(u, 0, 1);
        const cv = THREE.MathUtils.clamp(v, 0, 1);
        const edge = sampleElevation(data, cu * (meta.width - 1), cv * (meta.height - 1));
        const outX = Math.max(0, Math.abs(x) - halfW);
        const outZ = Math.max(0, Math.abs(z) - halfD);
        const distOut = Math.hypot(outX, outZ);
        if (edge < 4) {
          // gentle deepening — a steep drop builds a tall sunlit cliff along
          // the land/ocean rule boundary that reads as a bright spike end-on
          elev = Math.min(edge, -20) - distOut * 1.2;
        } else {
          // collapse the edge profile to a featureless low plain almost
          // immediately — extruding the boundary row's ridges outward is what
          // painted corduroy bands across the horizon
          const t = THREE.MathUtils.smoothstep(distOut, 0, 1.1);
          elev = edge * (1 - t) + 6 * t;
        }
        skirtT[i] = Math.min(1, distOut / 1.6);
      }
      elevs[i] = elev;
      pos.setXYZ(i, x, elev * meta.yScale, z);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();

    // Neutralize lighting in the skirt: its coastline step runs due north for
    // 30+ units and the low WNW sun turns any west-facing skirt slope into a
    // bright wall seen end-on. Flat normals -> flat light -> reads as haze.
    {
      const n = geo.attributes.normal as THREE.BufferAttribute;
      for (let i = 0; i < n.count; i++) {
        const t = Math.min(1, skirtT[i] * 1.6);
        if (t <= 0) continue;
        const nx = n.getX(i) * (1 - t);
        const ny = n.getY(i) * (1 - t) + t;
        const nz = n.getZ(i) * (1 - t);
        const m = Math.hypot(nx, ny, nz) || 1;
        n.setXYZ(i, nx / m, ny / m, nz / m);
      }
      n.needsUpdate = true;
    }

    // color pass — slope comes from the exaggerated mesh normals so the grade
    // matches what the eye sees
    const normals = geo.attributes.normal as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const tmp = new THREE.Color();
    const haze = new THREE.Color(TOKENS.fog).multiplyScalar(0.45);
    for (let i = 0; i < pos.count; i++) {
      const slope = 1 - normals.getY(i);
      albedo(elevs[i], slope, tmp);
      // skirt fades to haze-colored ground: out there nothing should carry
      // lighting contrast, or lit faces read as bright walls through the fog
      if (skirtT[i] > 0) tmp.lerp(haze, skirtT[i] * 0.9);
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [data]);

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
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        vertexColors
      />
    </mesh>
  );
}
