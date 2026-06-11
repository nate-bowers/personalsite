/**
 * CPU twin of the Water.tsx vertex shader. The buoys sample this each frame so they
 * heave/pitch/roll on the SAME wave function that displaces the water surface — the
 * coupling that makes them sit IN the sea, not on it (DESIGN-PHASE2.md §4).
 *
 * IMPORTANT: these wave constants MUST stay identical to the three waves in
 * app/components/three/Water.tsx. If you change one, change both.
 */

export interface GerstnerParams {
  ampScale: number;
  speed: number;
  windChop: number;
}

interface Wave {
  dir: [number, number];
  L: number;
  A: number;
  Q: number;
  sp: number;
  chop?: boolean;
}

const norm = (d: [number, number]): [number, number] => {
  const m = Math.hypot(d[0], d[1]) || 1;
  return [d[0] / m, d[1] / m];
};

const WAVES: Wave[] = [
  { dir: norm([1, 0.2]), L: 9.0, A: 0.12, Q: 0.6, sp: 1.3 },
  { dir: norm([0.7, -0.7]), L: 5.0, A: 0.07, Q: 0.7, sp: 1.7 },
  { dir: norm([0.3, 1.0]), L: 2.6, A: 0.035, Q: 0.8, sp: 2.2, chop: true },
];

export interface Surface {
  /** water height (world Y) at (wx, wz) */
  height: number;
  /** world-space surface normal */
  normal: [number, number, number];
}

/**
 * The water mesh is a plane rotated [-PI/2, 0, 0], so local (px, py) -> world (x, -z)
 * and local height (z) -> world Y. We evaluate in local coords (px = wx, py = -wz).
 */
export function waterSurface(wx: number, wz: number, t: number, p: GerstnerParams): Surface {
  const px = wx;
  const py = -wz;
  let height = 0;
  let nlx = 0;
  let nly = 0;
  let nlz = 1;

  for (const w of WAVES) {
    const k = (2 * Math.PI) / w.L;
    const A = w.A * (w.chop ? 0.5 + p.windChop : 1) * p.ampScale;
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
