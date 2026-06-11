/**
 * Build-time terrain generation for The Coast (Phase 2).
 * Downloads Terrarium-encoded elevation tiles from the AWS Open Data set
 * (s3://elevation-tiles-prod, no API key), decodes them to a heightfield,
 * resamples to a fixed grid, exaggerates vertical scale, clamps the ocean to a
 * shallow shelf, and writes a binary heightmap + metadata + anchor coordinates
 * into /public/terrain. See DESIGN-PHASE2.md §2 and §5.
 *
 *   node scripts/build-terrain.mjs       (or: pnpm build:terrain)
 *
 * Idempotent: downloaded tiles are cached in ./.terrain-cache (gitignored);
 * the emitted assets ARE committed.
 */
import sharp from "sharp";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";

const Z = 11; // zoom level — ~19km/tile; finer detail for the compact Bay Area
const OUT_W = 1024;
const OUT_H = 896;

// San Francisco Bay Area bounding box: the Pacific + Half Moon Bay coast (W),
// the SF peninsula + bay, Marin (N), the East Bay, and the South Bay down to
// Stanford / Santa Clara. The real bathymetry + a small sea-level bump flood the
// bay, so the land reads as the actual Bay Area.
const BBOX = { lngMin: -122.95, lngMax: -121.82, latMin: 37.22, latMax: 38.02 };

const SCENE_WIDTH = 15; // scene units, E-W
const SCENE_DEPTH = 13.5; // scene units, N-S
const OCEAN_CLAMP_M = -60; // shallow negative shelf, not a deep trench
const Y_SCALE = 0.0017; // metres -> scene Y
const SEA_LEVEL_OFFSET = -5; // metres — raise sea level so SF Bay floods cleanly
const SMOOTH_RADIUS = 2; // box-blur radius for de-spiking
const SMOOTH_PASSES = 3;

// A lineup of buoys down the Pacific coast (all west of the wiggly coastline so they
// float on the open ocean, not inland).
const ANCHORS = [
  { slug: "about", label: "About", place: "STINSON", lat: 37.9, lng: -122.72 },
  { slug: "resume", label: "Resume", place: "OCEAN BEACH", lat: 37.7, lng: -122.57 },
  { slug: "projects", label: "Projects", place: "MAVERICKS", lat: 37.5, lng: -122.54 },
  { slug: "contact", label: "Contact", place: "HALF MOON BAY", lat: 37.44, lng: -122.55 },
  { slug: "ask", label: "Ask Nate", place: "STN 46012", lat: 37.36, lng: -122.88 },
];

const TILE_BASE = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium";
const ROOT = process.cwd();
const CACHE_DIR = path.join(ROOT, ".terrain-cache", String(Z));
const OUT_DIR = path.join(ROOT, "public", "terrain");

const DEG = Math.PI / 180;
const lng2tileX = (lng) => ((lng + 180) / 360) * 2 ** Z;
const lat2tileY = (lat) =>
  ((1 - Math.asinh(Math.tan(lat * DEG)) / Math.PI) / 2) * 2 ** Z;

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function getTile(tx, ty) {
  const cachePath = path.join(CACHE_DIR, `${tx}_${ty}.png`);
  if (!(await exists(cachePath))) {
    const url = `${TILE_BASE}/${Z}/${tx}/${ty}.png`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`tile ${tx},${ty} HTTP ${res.status}`);
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(cachePath, Buffer.from(await res.arrayBuffer()));
  }
  const { data, info } = await sharp(await readFile(cachePath))
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height, ch: info.channels };
}

// Terrarium: elevation(m) = (R*256 + G + B/256) - 32768
const decode = (r, g, b) => r * 256 + g + b / 256 - 32768;

// Separable box blur — turns single-pixel data spikes into readable ridgelines.
function boxBlur(src, w, h, radius) {
  const tmp = new Float32Array(src.length);
  const dst = new Float32Array(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      let n = 0;
      for (let dx = -radius; dx <= radius; dx++) {
        const xx = Math.min(w - 1, Math.max(0, x + dx));
        s += src[y * w + xx];
        n++;
      }
      tmp[y * w + x] = s / n;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      let n = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const yy = Math.min(h - 1, Math.max(0, y + dy));
        s += tmp[yy * w + x];
        n++;
      }
      dst[y * w + x] = s / n;
    }
  }
  return dst;
}

async function main() {
  const x0 = Math.floor(lng2tileX(BBOX.lngMin));
  const x1 = Math.floor(lng2tileX(BBOX.lngMax));
  const y0 = Math.floor(lat2tileY(BBOX.latMax)); // north -> smaller y
  const y1 = Math.floor(lat2tileY(BBOX.latMin));
  const cols = x1 - x0 + 1;
  const rows = y1 - y0 + 1;
  console.log(`Tiles z${Z}: x ${x0}..${x1} (${cols}), y ${y0}..${y1} (${rows}) = ${cols * rows} tiles`);

  // Stitch all tiles into one elevation grid.
  const gridW = cols * 256;
  const gridH = rows * 256;
  const grid = new Float32Array(gridW * gridH);
  let downloaded = 0;
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const { data, w, h, ch } = await getTile(tx, ty);
      const ox = (tx - x0) * 256;
      const oy = (ty - y0) * 256;
      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const s = (py * w + px) * ch;
          grid[(oy + py) * gridW + (ox + px)] = decode(data[s], data[s + 1], data[s + 2]);
        }
      }
      downloaded++;
      if (downloaded % 8 === 0) console.log(`  decoded ${downloaded}/${cols * rows}`);
    }
  }

  // Bilinear sample of the stitched grid at a fractional pixel.
  const sampleGrid = (fx, fy) => {
    fx = Math.max(0, Math.min(gridW - 1.001, fx));
    fy = Math.max(0, Math.min(gridH - 1.001, fy));
    const x = Math.floor(fx);
    const y = Math.floor(fy);
    const dx = fx - x;
    const dy = fy - y;
    const a = grid[y * gridW + x];
    const b = grid[y * gridW + x + 1];
    const c = grid[(y + 1) * gridW + x];
    const d = grid[(y + 1) * gridW + x + 1];
    return a * (1 - dx) * (1 - dy) + b * dx * (1 - dy) + c * (1 - dx) * dy + d * dx * dy;
  };

  // Resample to the output grid mapped to a regular lat/lng bbox.
  let out = new Float32Array(OUT_W * OUT_H);
  let min = Infinity;
  let max = -Infinity;
  for (let oy = 0; oy < OUT_H; oy++) {
    const lat = BBOX.latMax - (oy / (OUT_H - 1)) * (BBOX.latMax - BBOX.latMin);
    const gy = (lat2tileY(lat) - y0) * 256;
    for (let ox = 0; ox < OUT_W; ox++) {
      const lng = BBOX.lngMin + (ox / (OUT_W - 1)) * (BBOX.lngMax - BBOX.lngMin);
      const gx = (lng2tileX(lng) - x0) * 256;
      let elev = sampleGrid(gx, gy) + SEA_LEVEL_OFFSET;
      if (elev < OCEAN_CLAMP_M) elev = OCEAN_CLAMP_M; // shallow shelf
      out[oy * OUT_W + ox] = elev;
      if (elev < min) min = elev;
      if (elev > max) max = elev;
    }
  }
  console.log(`Heightmap ${OUT_W}x${OUT_H}: raw elevation ${min.toFixed(0)}m..${max.toFixed(0)}m`);

  // De-spike so steep coastal ranges read as ridgelines, not needles.
  for (let i = 0; i < SMOOTH_PASSES; i++) out = boxBlur(out, OUT_W, OUT_H, SMOOTH_RADIUS);

  // Deepen the offshore seafloor so it sits safely below the water-plane wave troughs
  // (otherwise troughs expose the dark ocean terrain as "holes" in the sea).
  for (let i = 0; i < out.length; i++) {
    if (out[i] < 0) out[i] = Math.max(-500, out[i] * 6);
  }

  // Fill the inland side of a wiggly coastline so there is NO inland water — the ocean
  // lives only on the Pacific (west) side, and the coast runs N-S up the scene. Any
  // water east of the coast is raised to gentle rolling land.
  for (let oy = 0; oy < OUT_H; oy++) {
    const lat = BBOX.latMax - (oy / (OUT_H - 1)) * (BBOX.latMax - BBOX.latMin);
    const coastLng = -122.46 + 0.05 * Math.sin(lat * 24) + 0.022 * Math.sin(lat * 57 + 1.3);
    for (let ox = 0; ox < OUT_W; ox++) {
      const lng = BBOX.lngMin + (ox / (OUT_W - 1)) * (BBOX.lngMax - BBOX.lngMin);
      if (lng <= coastLng) continue; // west of the coast = ocean, leave it
      const hill = 12 + 34 * (Math.sin(lng * 34 + lat * 41) * 0.5 + 0.5);
      if (out[oy * OUT_W + ox] < hill) out[oy * OUT_W + ox] = hill;
    }
  }

  // Keep a small water inlet at the Golden Gate so the bridge spans water.
  for (let oy = 0; oy < OUT_H; oy++) {
    const lat = BBOX.latMax - (oy / (OUT_H - 1)) * (BBOX.latMax - BBOX.latMin);
    if (lat < 37.795 || lat > 37.85) continue;
    for (let ox = 0; ox < OUT_W; ox++) {
      const lng = BBOX.lngMin + (ox / (OUT_W - 1)) * (BBOX.lngMax - BBOX.lngMin);
      if (lng < -122.52 || lng > -122.45) continue;
      out[oy * OUT_W + ox] = Math.min(out[oy * OUT_W + ox], -120);
    }
  }
  out = boxBlur(out, OUT_W, OUT_H, 1); // soften the channel walls

  min = Infinity;
  max = -Infinity;
  for (let i = 0; i < out.length; i++) {
    if (out[i] < min) min = out[i];
    if (out[i] > max) max = out[i];
  }
  console.log(`Smoothed (${SMOOTH_PASSES}x r${SMOOTH_RADIUS}): ${min.toFixed(0)}m..${max.toFixed(0)}m`);

  // lat/lng -> output grid cell (for anchor elevation sampling)
  const cellOf = (lng, lat) => {
    const gx = ((lng - BBOX.lngMin) / (BBOX.lngMax - BBOX.lngMin)) * (OUT_W - 1);
    const gy = ((BBOX.latMax - lat) / (BBOX.latMax - BBOX.latMin)) * (OUT_H - 1);
    return { gx, gy };
  };
  const sampleOut = (lng, lat) => {
    const { gx, gy } = cellOf(lng, lat);
    const x = Math.max(0, Math.min(OUT_W - 2, Math.floor(gx)));
    const y = Math.max(0, Math.min(OUT_H - 2, Math.floor(gy)));
    return out[y * OUT_W + x];
  };

  // lat/lng -> scene coordinates (N-S compressed).
  const sceneX = (lng) => ((lng - BBOX.lngMin) / (BBOX.lngMax - BBOX.lngMin)) * SCENE_WIDTH - SCENE_WIDTH / 2;
  const sceneZ = (lat) => ((BBOX.latMax - lat) / (BBOX.latMax - BBOX.latMin)) * SCENE_DEPTH - SCENE_DEPTH / 2;

  const anchors = ANCHORS.map((a) => {
    const elevMeters = Math.round(sampleOut(a.lng, a.lat));
    return {
      slug: a.slug,
      label: a.label,
      place: a.place,
      lat: a.lat,
      lng: a.lng,
      x: +sceneX(a.lng).toFixed(3),
      z: +sceneZ(a.lat).toFixed(3),
      elevMeters,
      terrainY: +(elevMeters * Y_SCALE).toFixed(3),
    };
  });

  const meta = {
    z: Z,
    bbox: BBOX,
    width: OUT_W,
    height: OUT_H,
    sceneWidth: SCENE_WIDTH,
    sceneDepth: SCENE_DEPTH,
    seaLevel: 0,
    yScale: Y_SCALE,
    oceanClampM: OCEAN_CLAMP_M,
    elevMin: Math.round(min),
    elevMax: Math.round(max),
    source: "AWS Open Data Terrarium terrain tiles (USGS-derived elevation)",
  };

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(path.join(OUT_DIR, "heightmap.bin"), Buffer.from(out.buffer));
  await writeFile(path.join(OUT_DIR, "meta.json"), JSON.stringify(meta, null, 2));
  await writeFile(path.join(OUT_DIR, "anchors.json"), JSON.stringify(anchors, null, 2));

  console.log("\nAnchors:");
  for (const a of anchors) {
    console.log(`  ${a.place.padEnd(10)} (${a.slug}) -> x=${a.x} z=${a.z} elev=${a.elevMeters}m`);
  }
  console.log(`\nWrote public/terrain/{heightmap.bin (${out.byteLength} bytes), meta.json, anchors.json}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
