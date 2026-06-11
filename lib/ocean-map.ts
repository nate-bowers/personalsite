import type { Conditions } from "./ndbc";

/**
 * The conditions-to-motion mapping, shared by BOTH the v1 2D canvas ocean and the
 * Phase 2 3D Gerstner water so they read the live buoy identically. See DESIGN.md §4
 * / DESIGN-PHASE2.md §4. Each renderer applies these normalized factors to its own
 * base wave geometry; the mapping itself is the single source of truth.
 */

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export interface OceanParams {
  waveHeightFt: number;
  periodS: number;
  windKts: number;
  /** wave amplitude multiplier: 0.3x at 1ft -> 1.6x at 12ft, clamped */
  ampScale: number;
  /** animation speed: 8s period = baseline 1.0, inverse, clamped */
  speed: number;
  /** high-frequency chop, 0..1, only above 15kts */
  windChop: number;
}

export function oceanParams(c: Conditions): OceanParams {
  const waveHeightFt = c.waveHeightFt ?? 3;
  const periodS = c.periodS ?? 8;
  const windKts = c.windKts ?? 0;
  return {
    waveHeightFt,
    periodS,
    windKts,
    ampScale: clamp(0.3 + ((waveHeightFt - 1) / 11) * (1.6 - 0.3), 0.3, 1.6),
    speed: clamp(8 / periodS, 0.35, 2.2),
    windChop: windKts > 15 ? clamp((windKts - 15) / 25, 0, 1) : 0,
  };
}
