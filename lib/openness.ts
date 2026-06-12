import { elevationAtScene, type TerrainData } from "./terrain";

/**
 * Open-water field: for each point on the sea, how exposed is it to Pacific
 * swell? 0 = land/sheltered (SF Bay behind the peninsula), 1 = deep open water.
 *
 * Two real-data terms, no hand-drawn masks:
 *  - depth: shallow water damps the swell (waves shoal and die at the beach)
 *  - fetch: rays marched toward the W/SW/S; if land blocks every ray the spot
 *    is sheltered. This is what keeps the bay calm while Steamer Lane — which
 *    faces south into Monterey Bay — still gets its swell.
 *
 * Computed once on a coarse grid at scene load (lives behind the lazy 3D
 * bundle); the water mesh bakes it into a vertex attribute and the buoys/ferry
 * sample it for their CPU wave coupling.
 */

const RAY_DIRS: [number, number][] = [
  [-1, 0], // W
  [-0.92, 0.38], // WSW
  [-0.71, 0.71], // SW
  [-0.38, 0.92], // SSW
  [0, 1], // S  (+z is south)
];
const RAY_STEP = 0.12;
const RAY_STEPS = 20; // ~2.4 scene units (~25 km) of fetch
const BLOCK_ELEV = 3; // metres — land this high blocks swell

export interface OpennessField {
  sample(x: number, z: number): number;
}

export function computeOpenness(data: TerrainData, gw = 110, gh = 140): OpennessField {
  const { sceneWidth, sceneDepth } = data.meta;
  const pad = 4;
  const x0 = -sceneWidth / 2 - pad;
  const x1 = sceneWidth / 2 + pad;
  const z0 = -sceneDepth / 2 - pad;
  const z1 = sceneDepth / 2 + pad;

  const raw = new Float32Array(gw * gh);
  for (let j = 0; j < gh; j++) {
    const z = z0 + (j / (gh - 1)) * (z1 - z0);
    for (let i = 0; i < gw; i++) {
      const x = x0 + (i / (gw - 1)) * (x1 - x0);
      const e = elevationAtScene(data, x, z);
      if (e > -0.5) {
        raw[j * gw + i] = 0; // land / waterline
        continue;
      }
      // depth term: -2m -> 0 … -18m -> 1
      const depth = Math.max(0, Math.min(1, (-e - 2) / 16));
      // fetch term: most-open ray toward the Pacific quadrant
      let fetch = 0;
      for (const [dx, dz] of RAY_DIRS) {
        let open = 1;
        for (let s = 1; s <= RAY_STEPS; s++) {
          const ex = elevationAtScene(data, x + dx * s * RAY_STEP, z + dz * s * RAY_STEP);
          if (ex > BLOCK_ELEV) {
            open = 0;
            break;
          }
        }
        if (open > fetch) fetch = open;
        if (fetch === 1) break;
      }
      raw[j * gw + i] = depth * fetch;
    }
  }

  // One 3x3 smoothing pass so the field has no hard seams.
  const sm = new Float32Array(gw * gh);
  for (let j = 0; j < gh; j++) {
    for (let i = 0; i < gw; i++) {
      let s = 0;
      let n = 0;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          const ii = i + di;
          const jj = j + dj;
          if (ii < 0 || jj < 0 || ii >= gw || jj >= gh) continue;
          s += raw[jj * gw + ii];
          n++;
        }
      }
      sm[j * gw + i] = s / n;
    }
  }

  return {
    sample(x: number, z: number): number {
      // west of the grid is the open Pacific
      if (x < x0) return 1;
      const fi = Math.max(0, Math.min(gw - 1.001, ((x - x0) / (x1 - x0)) * (gw - 1)));
      const fj = Math.max(0, Math.min(gh - 1.001, ((z - z0) / (z1 - z0)) * (gh - 1)));
      const i = Math.floor(fi);
      const j = Math.floor(fj);
      const di = fi - i;
      const dj = fj - j;
      return (
        sm[j * gw + i] * (1 - di) * (1 - dj) +
        sm[j * gw + i + 1] * di * (1 - dj) +
        sm[(j + 1) * gw + i] * (1 - di) * dj +
        sm[(j + 1) * gw + i + 1] * di * dj
      );
    },
  };
}
