/**
 * THE single source of truth for the Gerstner wave field. The water vertex
 * shader is GENERATED from WAVES (see gerstnerGlsl) and the CPU twin below
 * evaluates the identical maths — so the buoys, the ferry, and the rendered
 * surface all ride exactly the same sea. There is no second copy to drift.
 *
 * Swell arrives from the WNW (open Pacific) and rolls toward the coast; the
 * `open` factor (0 sheltered/shallow, 1 open deep water) scales amplitude so
 * the bay stays calm and waves die at the shoreline. It comes from real
 * bathymetry + ray-cast shelter, not a hand mask (lib/openness.ts).
 */

export interface GerstnerParams {
  ampScale: number;
  speed: number;
  windChop: number;
}

interface Wave {
  /** direction of travel in plane-local coords (px = world x, py = -world z) */
  dir: [number, number];
  L: number; // wavelength (scene units)
  A: number; // base amplitude (scene units)
  Q: number; // horizontal pinch
  sp: number; // phase-speed multiplier
  chop?: boolean; // scaled by wind chop
}

const norm = (d: [number, number]): [number, number] => {
  const m = Math.hypot(d[0], d[1]) || 1;
  return [d[0] / m, d[1] / m];
};

// WNW swell heading ESE into the coastline (world +x east, +z south).
export const WAVES: Wave[] = [
  { dir: norm([0.9, -0.42]), L: 9.0, A: 0.1, Q: 0.6, sp: 1.3 },
  { dir: norm([0.98, -0.12]), L: 4.6, A: 0.055, Q: 0.7, sp: 1.7 },
  { dir: norm([0.55, -0.82]), L: 2.4, A: 0.028, Q: 0.8, sp: 2.2, chop: true },
];

const f = (n: number) => n.toFixed(5);

/**
 * Unrolled GLSL for the wave sum. Expects in scope: `vec2 p` (plane-local),
 * `float A0` (ampScale * open factor), `uTime`, `uSpeed`, `uChop`. Writes
 * `height`, `horiz`, `nrm` (un-normalized local normal, z-up).
 */
export const gerstnerGlsl: string = WAVES.map((w, i) => {
  const amp = w.chop ? `${f(w.A)} * (0.5 + uChop) * A0` : `${f(w.A)} * A0`;
  return /* glsl */ `
    {
      vec2 d${i} = vec2(${f(w.dir[0])}, ${f(w.dir[1])});
      float k${i} = ${f((2 * Math.PI) / w.L)};
      float a${i} = ${amp};
      float ph${i} = k${i} * dot(d${i}, p) + uTime * ${f(w.sp)} * uSpeed;
      float c${i} = cos(ph${i});
      float s${i} = sin(ph${i});
      horiz += ${f(w.Q)} * a${i} * d${i} * c${i};
      height += a${i} * s${i};
      nrm.x -= d${i}.x * k${i} * a${i} * c${i};
      nrm.y -= d${i}.y * k${i} * a${i} * c${i};
      nrm.z -= ${f(w.Q)} * k${i} * a${i} * s${i};
    }`;
}).join("\n");

export interface Surface {
  /** water height (world Y) at (wx, wz) */
  height: number;
  /** world-space surface normal */
  normal: [number, number, number];
}

/**
 * CPU twin of the generated shader. `open` is the local open-water factor —
 * pass the value sampled at the same spot the mesh uses or the prop will
 * float above/below the rendered surface.
 */
export function waterSurface(
  wx: number,
  wz: number,
  t: number,
  p: GerstnerParams,
  open = 1,
): Surface {
  const px = wx;
  const py = -wz;
  const A0 = p.ampScale * open;
  let height = 0;
  let nlx = 0;
  let nly = 0;
  let nlz = 1;

  for (const w of WAVES) {
    const k = (2 * Math.PI) / w.L;
    const A = w.A * (w.chop ? 0.5 + p.windChop : 1) * A0;
    const ph = k * (w.dir[0] * px + w.dir[1] * py) + t * w.sp * p.speed;
    const c = Math.cos(ph);
    const s = Math.sin(ph);
    height += A * s;
    nlx -= w.dir[0] * k * A * c;
    nly -= w.dir[1] * k * A * c;
    nlz -= w.Q * k * A * s;
  }

  // local normal (z up) -> world via the [-PI/2,0,0] rotation: (x, z, -y)
  const wx2 = nlx;
  const wy2 = nlz;
  const wz2 = -nly;
  const m = Math.hypot(wx2, wy2, wz2) || 1;
  return { height, normal: [wx2 / m, wy2 / m, wz2 / m] };
}
