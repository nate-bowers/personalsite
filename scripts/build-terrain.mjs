/**
 * Build-time terrain generation for The Coast (Phase 2).
 * Downloads Terrarium-encoded elevation tiles from the AWS Open Data set
 * (s3://elevation-tiles-prod, no API key), decodes them to a heightfield,
 * resamples to a fixed grid, and writes a binary heightmap + metadata + anchor
 * coordinates into /public/terrain. See DESIGN-PHASE2.md §2 and §5.
 *
 *   node scripts/build-terrain.mjs       (or: pnpm build:terrain)
 *
 * The geography is REAL: the Northern California coast from Stinson Beach down
 * to Big Sur, including SF Bay (flooded by its real bathymetry), Monterey Bay's
 * curve, and the Santa Lucia range. No synthetic coastline, no inland fills —
 * if it looks wrong, fix the pipeline, don't paint over the data.
 *
 * Also emits terrain-preview.png: a top-down hypsometric render of the final
 * heightfield for eyeball verification against a real map.
 *
 * Idempotent: downloaded tiles are cached in ./.terrain-cache (gitignored);
 * the emitted assets ARE committed.
 */
import sharp from "sharp";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";

const Z = 10; // ~122m/px at 37°N — matches the output grid resolution
const OUT_W = 640; // grid columns (E-W)
const OUT_H = 896; // grid rows (N-S) — taller than wide; the coast runs N-S

// Secondary "far" tier: the rest of California around the core bbox, loaded
// lazily after the scene is up so the topography continues naturally to the
// fog wall instead of collapsing to a synthetic plain. Much coarser: z8 tiles
// (~611m/px) into a small int16 grid.
const FAR_Z = 8;
const FAR_BBOX = { lngMin: -124.8, lngMax: -117.4, latMin: 33.6, latMax: 41.0 };
const FAR_W = 576;
const FAR_H = 640;
const FAR_CLAMP_MAX = 3000; // high Sierra pokes through the haze (snowcapped)

// Bodega Bay (38.3°N, north of Marin so the frame-top is real coast, not a
// skirt extrusion) down to Big Sur (36.2°N), Pacific to the East Bay hills.
// Covers Mt Tam, the Golden Gate + SF Bay, the peninsula, Monterey Bay's
// curve, and the northern Santa Lucias.
const BBOX = { lngMin: -123.25, lngMax: -121.55, latMin: 36.1, latMax: 38.32 };

// Scene units. Geographic aspect is ~1.44 (216km N-S vs 151km E-W); the scene is
// 1.27 — a gentle along-coast compression per DESIGN-PHASE2.md §2 so the full run
// fits one camera shot without distorting the landforms beyond recognition.
const SCENE_WIDTH = 15; // scene units, E-W
const SCENE_DEPTH = 19; // scene units, N-S
const OCEAN_FLOOR_M = -160; // clamp the abyss to a shallow shelf (spec §2)
const Y_SCALE = 0.0016; // metres -> scene Y (vertical exaggeration for legibility)
const SEA_LEVEL_OFFSET = -2; // metres — guarantees SF Bay's surface sits below 0
const SMOOTH_RADIUS = 1; // gentle de-spike only; heavy blur erases the coastline
const SMOOTH_PASSES = 2;

// Section anchors at the real spots (DESIGN-PHASE2.md §2 spot map).
const ANCHORS = [
  { slug: "about", label: "About", place: "STINSON", lat: 37.9, lng: -122.644 },
  { slug: "projects", label: "Projects", place: "MAVERICKS", lat: 37.495, lng: -122.499 },
  { slug: "ask", label: "Ask Nate", place: "STN 46012", lat: 37.36, lng: -122.88 },
  { slug: "resume", label: "Resume", place: "STEAMER LANE", lat: 36.951, lng: -122.026 },
  { slug: "contact", label: "Contact", place: "BIG SUR", lat: 36.27, lng: -121.807 },
];

// Faint place names rendered ON the terrain (spec §2): positioned far enough
// inland that none projects under a buoy label pill from the default camera.
const PLACES = [
  { name: "MAVERICKS", lat: 37.52, lng: -122.33 },
  { name: "SANTA CRUZ", lat: 37.02, lng: -121.9 },
  { name: "BIG SUR", lat: 36.33, lng: -121.64 },
];

const TILE_BASE = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium";
const ROOT = process.cwd();
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

async function getTile(tx, ty, z = Z) {
  const dir = path.join(ROOT, ".terrain-cache", String(z));
  const cachePath = path.join(dir, `${tx}_${ty}.png`);
  if (!(await exists(cachePath))) {
    const url = `${TILE_BASE}/${z}/${tx}/${ty}.png`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`tile ${tx},${ty} HTTP ${res.status}`);
    await mkdir(dir, { recursive: true });
    await writeFile(cachePath, Buffer.from(await res.arrayBuffer()));
  }
  const { data, info } = await sharp(await readFile(cachePath))
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height, ch: info.channels };
}

const lng2tileXAt = (lng, z) => ((lng + 180) / 360) * 2 ** z;
const lat2tileYAt = (lat, z) =>
  ((1 - Math.asinh(Math.tan(lat * DEG)) / Math.PI) / 2) * 2 ** z;

/** Download, stitch and resample one tier into a Float32Array grid. */
async function buildTier(z, bbox, outW, outH, label) {
  const x0 = Math.floor(lng2tileXAt(bbox.lngMin, z));
  const x1 = Math.floor(lng2tileXAt(bbox.lngMax, z));
  const y0 = Math.floor(lat2tileYAt(bbox.latMax, z));
  const y1 = Math.floor(lat2tileYAt(bbox.latMin, z));
  const cols = x1 - x0 + 1;
  const rows = y1 - y0 + 1;
  console.log(`${label}: z${z}, ${cols * rows} tiles`);
  const gridW = cols * 256;
  const gridH = rows * 256;
  const grid = new Float32Array(gridW * gridH);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const { data, w, h, ch } = await getTile(tx, ty, z);
      const ox = (tx - x0) * 256;
      const oy = (ty - y0) * 256;
      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const s = (py * w + px) * ch;
          grid[(oy + py) * gridW + (ox + px)] = decode(data[s], data[s + 1], data[s + 2]);
        }
      }
    }
  }
  const sample = (fx, fy) => {
    fx = Math.max(0, Math.min(gridW - 1.001, fx));
    fy = Math.max(0, Math.min(gridH - 1.001, fy));
    const x = Math.floor(fx);
    const y = Math.floor(fy);
    const dx = fx - x;
    const dy = fy - y;
    return (
      grid[y * gridW + x] * (1 - dx) * (1 - dy) +
      grid[y * gridW + x + 1] * dx * (1 - dy) +
      grid[(y + 1) * gridW + x] * (1 - dx) * dy +
      grid[(y + 1) * gridW + x + 1] * dx * dy
    );
  };
  const out = new Float32Array(outW * outH);
  for (let oy = 0; oy < outH; oy++) {
    const lat = bbox.latMax - (oy / (outH - 1)) * (bbox.latMax - bbox.latMin);
    const gy = (lat2tileYAt(lat, z) - y0) * 256;
    for (let ox = 0; ox < outW; ox++) {
      const lng = bbox.lngMin + (ox / (outW - 1)) * (bbox.lngMax - bbox.lngMin);
      const gx = (lng2tileXAt(lng, z) - x0) * 256;
      out[oy * outW + ox] = sample(gx, gy);
    }
  }
  return out;
}

// Terrarium: elevation(m) = (R*256 + G + B/256) - 32768
const decode = (r, g, b) => r * 256 + g + b / 256 - 32768;

/**
 * Raise inland depressions above the waterline. The global water plane sits at
 * y=0, so any below-sea-level cell NOT hydrologically connected to the Pacific
 * (Central Valley floor, Tulare basin, Delta islands behind sills) would show
 * "ocean" inland. Flood-fill from the open-ocean west edge through below-water
 * cells; whatever stays unreached is land — floor it safely above the plane.
 */
function raiseInlandDepressions(grid, w, h) {
  const PASSABLE = 0.5; // metres — water can spread through cells below this
  const visited = new Uint8Array(w * h);
  const queue = [];
  for (let y = 0; y < h; y++) {
    if (grid[y * w] < PASSABLE) {
      visited[y * w] = 1;
      queue.push(y * w);
    }
  }
  while (queue.length) {
    const i = queue.pop();
    const x = i % w;
    const y = (i / w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (visited[ni] || grid[ni] >= PASSABLE) continue;
      visited[ni] = 1;
      queue.push(ni);
    }
  }
  let raised = 0;
  for (let i = 0; i < grid.length; i++) {
    if (!visited[i] && grid[i] < 3) {
      grid[i] = 6; // above the plane with margin against far-distance z-fighting
      raised++;
    }
  }
  return raised;
}

/**
 * The water stops after the bay. Suisun Bay and the Delta are hydrologically
 * connected through Carquinez (so the flood-fill keeps them), but the scene
 * wants dry valley east of the bay — farmland, not inland sea. Raise every
 * below-sea cell east of Carquinez in the bay's latitudes, blended over a
 * ~5 km band so the strait reads as a river narrowing into land.
 */
function cutDeltaWater(grid, w, h, bbox) {
  const CUT_LNG = -122.16; // just east of the Carquinez bend
  const BAND = 0.06; // degrees of blend
  const MIN_LAT = 37.82; // protect the South Bay (its water sits below this)
  let cut = 0;
  for (let y = 0; y < h; y++) {
    const lat = bbox.latMax - (y / (h - 1)) * (bbox.latMax - bbox.latMin);
    if (lat <= MIN_LAT) continue;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (grid[i] >= 3) continue;
      const lng = bbox.lngMin + (x / (w - 1)) * (bbox.lngMax - bbox.lngMin);
      if (lng <= CUT_LNG - BAND) continue;
      const t = Math.min(1, (lng - (CUT_LNG - BAND)) / BAND);
      const tt = t * t * (3 - 2 * t);
      const target = 6;
      const next = grid[i] * (1 - tt) + target * tt;
      if (next > grid[i]) {
        grid[i] = next;
        cut++;
      }
    }
  }
  return cut;
}

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

// Top-down hypsometric tint for the verification render: blues below sea level,
// sand -> grass -> forest -> rock above it.
function tint(elev) {
  if (elev < 0) {
    const t = Math.min(1, -elev / 160);
    return [Math.round(90 - 50 * t), Math.round(140 - 70 * t), Math.round(190 - 70 * t)];
  }
  const stops = [
    [0, [222, 205, 160]],
    [40, [196, 186, 110]],
    [220, [120, 150, 84]],
    [550, [80, 112, 64]],
    [900, [140, 120, 92]],
    [1400, [200, 188, 170]],
  ];
  for (let i = 1; i < stops.length; i++) {
    if (elev <= stops[i][0]) {
      const [e0, c0] = stops[i - 1];
      const [e1, c1] = stops[i];
      const t = (elev - e0) / (e1 - e0);
      return c0.map((c, k) => Math.round(c + (c1[k] - c) * t));
    }
  }
  return stops[stops.length - 1][1];
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
      if (downloaded % 10 === 0) console.log(`  decoded ${downloaded}/${cols * rows}`);
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
  for (let oy = 0; oy < OUT_H; oy++) {
    const lat = BBOX.latMax - (oy / (OUT_H - 1)) * (BBOX.latMax - BBOX.latMin);
    const gy = (lat2tileY(lat) - y0) * 256;
    for (let ox = 0; ox < OUT_W; ox++) {
      const lng = BBOX.lngMin + (ox / (OUT_W - 1)) * (BBOX.lngMax - BBOX.lngMin);
      const gx = (lng2tileX(lng) - x0) * 256;
      let elev = sampleGrid(gx, gy) + SEA_LEVEL_OFFSET;
      // Shallow negative shelf: the real Monterey submarine canyon is -3000m+;
      // clamping keeps wave troughs covered without a visible abyss.
      if (elev < OCEAN_FLOOR_M) elev = OCEAN_FLOOR_M;
      out[oy * OUT_W + ox] = elev;
    }
  }

  // Gentle de-spike. Anything stronger erases the Golden Gate strait (≈3 px wide
  // at this resolution) — the old build's heavy blur + ×6 bathymetry amplification
  // was the source of the corduroy banding.
  for (let i = 0; i < SMOOTH_PASSES; i++) out = boxBlur(out, OUT_W, OUT_H, SMOOTH_RADIUS);

  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < out.length; i++) {
    if (out[i] < min) min = out[i];
    if (out[i] > max) max = out[i];
  }
  console.log(`Heightmap ${OUT_W}x${OUT_H}: ${min.toFixed(0)}m..${max.toFixed(0)}m`);
  console.log(`  raised ${raiseInlandDepressions(out, OUT_W, OUT_H)} inland below-sea cells (core)`);
  console.log(`  cut ${cutDeltaWater(out, OUT_W, OUT_H, BBOX)} delta-water cells east of Carquinez (core)`);

  // lat/lng -> scene coordinates (mild N-S compression).
  const sceneX = (lng) => ((lng - BBOX.lngMin) / (BBOX.lngMax - BBOX.lngMin)) * SCENE_WIDTH - SCENE_WIDTH / 2;
  const sceneZ = (lat) => ((BBOX.latMax - lat) / (BBOX.latMax - BBOX.latMin)) * SCENE_DEPTH - SCENE_DEPTH / 2;

  const sampleLngLat = (lng, lat) => {
    const gx = ((lng - BBOX.lngMin) / (BBOX.lngMax - BBOX.lngMin)) * (OUT_W - 1);
    const gy = ((BBOX.latMax - lat) / (BBOX.latMax - BBOX.latMin)) * (OUT_H - 1);
    const x = Math.max(0, Math.min(OUT_W - 2, Math.floor(gx)));
    const y = Math.max(0, Math.min(OUT_H - 2, Math.floor(gy)));
    return out[y * OUT_W + x];
  };

  const anchors = ANCHORS.map((a) => {
    // Ocean anchors must land in water. The spec coords sit at the waterline;
    // if a cell comes back dry (shoreline rasterization), walk west in small
    // steps until it's wet. Keeps the real spot, guarantees a floating buoy.
    let lng = a.lng;
    let steps = 0;
    while (sampleLngLat(lng, a.lat) > -10 && steps < 30) {
      lng -= 0.004;
      steps++;
    }
    const elevMeters = Math.round(sampleLngLat(lng, a.lat));
    if (steps > 0) console.log(`  (nudged ${a.place} ${(a.lng - lng).toFixed(3)}° west into water)`);
    return {
      slug: a.slug,
      label: a.label,
      place: a.place,
      lat: a.lat,
      lng,
      x: +sceneX(lng).toFixed(3),
      z: +sceneZ(a.lat).toFixed(3),
      elevMeters,
      terrainY: +(elevMeters * Y_SCALE).toFixed(3),
    };
  });

  const places = PLACES.map((p) => ({
    name: p.name,
    x: +sceneX(p.lng).toFixed(3),
    z: +sceneZ(p.lat).toFixed(3),
    elevMeters: Math.round(sampleLngLat(p.lng, p.lat)),
  }));

  // ---- far tier: surrounding California at z8 (lazy-loaded by the client) ----
  let far = await buildTier(FAR_Z, FAR_BBOX, FAR_W, FAR_H, "Far tier");
  for (let i = 0; i < far.length; i++) {
    let e = far[i] + SEA_LEVEL_OFFSET;
    if (e < OCEAN_FLOOR_M) e = OCEAN_FLOOR_M;
    if (e > FAR_CLAMP_MAX) e = FAR_CLAMP_MAX;
    far[i] = e;
  }
  far = boxBlur(far, FAR_W, FAR_H, 1);
  console.log(`  raised ${raiseInlandDepressions(far, FAR_W, FAR_H)} inland below-sea cells (far)`);
  console.log(`  cut ${cutDeltaWater(far, FAR_W, FAR_H, FAR_BBOX)} delta-water cells east of Carquinez (far)`);
  const farQuant = new Int16Array(far.length);
  for (let i = 0; i < far.length; i++) farQuant[i] = Math.round(far[i]);

  const meta = {
    z: Z,
    bbox: BBOX,
    width: OUT_W,
    height: OUT_H,
    far: {
      z: FAR_Z,
      bbox: FAR_BBOX,
      width: FAR_W,
      height: FAR_H,
      clampMax: FAR_CLAMP_MAX,
    },
    sceneWidth: SCENE_WIDTH,
    sceneDepth: SCENE_DEPTH,
    seaLevel: 0,
    yScale: Y_SCALE,
    oceanClampM: OCEAN_FLOOR_M,
    elevMin: Math.round(min),
    elevMax: Math.round(max),
    encoding: "int16",
    source: "AWS Open Data Terrarium terrain tiles (USGS-derived elevation)",
  };

  // Quantize to int16 metres — halves the payload with sub-metre-irrelevant loss.
  const quantized = new Int16Array(out.length);
  for (let i = 0; i < out.length; i++) quantized[i] = Math.round(out[i]);

  // Top-down hypsometric verification render (with anchor dots).
  const rgb = Buffer.alloc(OUT_W * OUT_H * 3);
  for (let i = 0; i < out.length; i++) {
    const [r, g, b] = tint(out[i]);
    rgb[i * 3] = r;
    rgb[i * 3 + 1] = g;
    rgb[i * 3 + 2] = b;
  }
  for (const a of anchors) {
    const gx = Math.round(((a.lng - BBOX.lngMin) / (BBOX.lngMax - BBOX.lngMin)) * (OUT_W - 1));
    const gy = Math.round(((BBOX.latMax - a.lat) / (BBOX.latMax - BBOX.latMin)) * (OUT_H - 1));
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        if (dx * dx + dy * dy > 9) continue;
        const px = gx + dx;
        const py = gy + dy;
        if (px < 0 || py < 0 || px >= OUT_W || py >= OUT_H) continue;
        const k = (py * OUT_W + px) * 3;
        rgb[k] = 255;
        rgb[k + 1] = 80;
        rgb[k + 2] = 40;
      }
    }
  }

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(path.join(OUT_DIR, "heightmap.bin"), Buffer.from(quantized.buffer));
  await writeFile(path.join(OUT_DIR, "far.bin"), Buffer.from(farQuant.buffer));
  await writeFile(path.join(OUT_DIR, "meta.json"), JSON.stringify(meta, null, 2));
  await writeFile(
    path.join(OUT_DIR, "anchors.json"),
    JSON.stringify({ anchors, places }, null, 2),
  );
  await sharp(rgb, { raw: { width: OUT_W, height: OUT_H, channels: 3 } })
    .png()
    .toFile(path.join(OUT_DIR, "terrain-preview.png"));

  console.log("\nAnchors:");
  for (const a of anchors) {
    console.log(`  ${a.place.padEnd(12)} (${a.slug}) -> x=${a.x} z=${a.z} elev=${a.elevMeters}m`);
  }
  console.log(`\nWrote public/terrain/{heightmap.bin (${quantized.byteLength} bytes), meta.json, anchors.json, terrain-preview.png}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
