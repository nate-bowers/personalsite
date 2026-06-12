/**
 * Client-side loader + helpers for the committed terrain assets in /public/terrain
 * (produced by scripts/build-terrain.mjs). The heightmap is int16-quantized metres
 * (~1MB raw); it sits behind the lazy 3D bundle so it never blocks first paint.
 */

export interface TerrainMeta {
  z: number;
  bbox: { lngMin: number; lngMax: number; latMin: number; latMax: number };
  width: number;
  height: number;
  sceneWidth: number;
  sceneDepth: number;
  seaLevel: number;
  yScale: number;
  oceanClampM: number;
  elevMin: number;
  elevMax: number;
  encoding: string;
  source: string;
}

export interface Anchor {
  slug: string;
  label: string;
  place: string;
  lat: number;
  lng: number;
  x: number;
  z: number;
  elevMeters: number;
  terrainY: number;
}

export interface Place {
  name: string;
  x: number;
  z: number;
  elevMeters: number;
}

export interface TerrainData {
  meta: TerrainMeta;
  anchors: Anchor[];
  places: Place[];
  heights: Float32Array;
}

let cache: Promise<TerrainData> | null = null;

export function loadTerrain(): Promise<TerrainData> {
  if (!cache) {
    cache = (async () => {
      const [meta, anchorsFile, bin] = await Promise.all([
        fetch("/terrain/meta.json").then((r) => r.json()),
        fetch("/terrain/anchors.json").then((r) => r.json()),
        fetch("/terrain/heightmap.bin").then((r) => r.arrayBuffer()),
      ]);
      const heights = Float32Array.from(new Int16Array(bin));
      return {
        meta,
        anchors: anchorsFile.anchors,
        places: anchorsFile.places,
        heights,
      } as TerrainData;
    })();
    // a transient fetch failure must not strand the page on the loading
    // state forever — clear the cache so a remount can retry
    cache.catch(() => {
      cache = null;
    });
  }
  return cache;
}

/** Bilinear elevation (metres) at fractional grid coords. */
export function sampleElevation(d: TerrainData, gx: number, gz: number): number {
  const { width: W, height: H } = d.meta;
  gx = Math.max(0, Math.min(W - 1.001, gx));
  gz = Math.max(0, Math.min(H - 1.001, gz));
  const x = Math.floor(gx);
  const z = Math.floor(gz);
  const dx = gx - x;
  const dz = gz - z;
  const h = d.heights;
  const a = h[z * W + x];
  const b = h[z * W + x + 1];
  const c = h[(z + 1) * W + x];
  const e = h[(z + 1) * W + x + 1];
  return a * (1 - dx) * (1 - dz) + b * dx * (1 - dz) + c * (1 - dx) * dz + e * dx * dz;
}

/** Real lng/lat -> scene (x, z), using the same transform as the build script. */
export function lngLatToScene(meta: TerrainMeta, lng: number, lat: number): [number, number] {
  const { bbox, sceneWidth, sceneDepth } = meta;
  const x = ((lng - bbox.lngMin) / (bbox.lngMax - bbox.lngMin)) * sceneWidth - sceneWidth / 2;
  const z = ((bbox.latMax - lat) / (bbox.latMax - bbox.latMin)) * sceneDepth - sceneDepth / 2;
  return [x, z];
}

/** Elevation in metres at scene (x,z). */
export function elevationAtScene(d: TerrainData, x: number, z: number): number {
  const { sceneWidth, sceneDepth, width, height } = d.meta;
  const u = (x + sceneWidth / 2) / sceneWidth; // 0=west .. 1=east
  const v = (z + sceneDepth / 2) / sceneDepth; // 0=north .. 1=south
  return sampleElevation(d, u * (width - 1), v * (height - 1));
}

/** Scene (x,z) -> terrain surface height in scene units. */
export function terrainYAtScene(d: TerrainData, x: number, z: number): number {
  return elevationAtScene(d, x, z) * d.meta.yScale;
}

/**
 * Open-water factor at scene (x,z): 1 in deep offshore water, fading to 0 in the
 * shallows and the bay. Drives Gerstner amplitude so swell rolls on the Pacific
 * and the bay stays calm — from real bathymetry, not a hand-drawn mask.
 */
export function openWaterAtScene(d: TerrainData, x: number, z: number): number {
  const e = elevationAtScene(d, x, z);
  const t = (-e - 4) / 56; // -4m -> 0, -60m -> 1
  return Math.max(0, Math.min(1, t));
}
