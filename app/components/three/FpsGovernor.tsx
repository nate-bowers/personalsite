"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { getQuality, setQuality } from "@/lib/quality";
import { isCameraFlying } from "@/lib/camera-bus";

/**
 * Runtime performance governor — the guaranteed-minimum-FPS safety net.
 *
 * The static device heuristics in lib/quality (cores / memory / viewport, plus
 * the GPU hint) classify the START tier, but a laptop with WebGL2 and enough
 * cores/RAM yet a weak GPU can still pass them and then render the FULL tier at
 * ~5fps. Device hints can't see that; only measured frame rate can. This watches
 * the live EWMA FPS and walks a one-way downgrade ladder until a floor holds:
 *
 *   Tier A  drop the actual DPR (×0.8 per step) down to DPR_FLOOR — the cheapest,
 *           most effective GPU-fill lever, invisible to every child (no child
 *           reads DPR as a prop).
 *   Tier B  flip the quality store full→calm — Terrain/Water/Trees/FarLayer all
 *           key their geometry useMemo on quality and genuinely rebuild smaller.
 *   Tier C  (terminal, latched) escalate to the static coast image. Fires at most
 *           once, only when FPS stays below FLOOR even after A+B are exhausted.
 *
 * TARGET (30) drives the cheap A/B levers; FLOOR (24) is the ONLY threshold that
 * can reach terminal static — a weak-but-acceptable 25–29fps laptop is left on
 * the live scene after calm rather than nuked to an image. Asymmetric hysteresis
 * (accrue slowly, decay 2×) plus a warm-up, a sustain window, and a settle gap
 * keep it from thrashing; flights freeze escalation so the Tier-B rebuild lands
 * at rest. Monotonic: it never raises DPR or flips back to full this session.
 *
 * DPR discipline: this owns the ACTUAL device pixel ratio via imperative setDpr.
 * CoastScene's `dpr` prop stays a pure per-tier CEILING; the only reconciliation
 * point is the Tier-B calm re-render (which re-applies the [1,1.25] ceiling), so
 * we re-assert our lower ratio for a few frames afterwards.
 */

const TARGET_FPS = 30; // below this (sustained) → take the next cheap A/B action
const FLOOR_FPS = 24; // below this (sustained, after A+B exhausted) → go static
const DPR_FLOOR = 0.7; // lowest device pixel ratio we will drop to
const DPR_STEP = 0.8; // multiply the ratio by this each Tier-A step
const CALM_DPR_CEILING = 1.25; // CoastScene's calm dpr cap; re-assert under it
const EWMA_ALPHA = 0.1; // FPS smoothing
const SUSTAIN_SECS = 4; // continuous sub-threshold seconds before acting
const SETTLE_MS = 4000; // minimum gap between rungs (must exceed a rebuild hitch)
const WARMUP_MS = 2500; // grace after first-ready before any action
const MAX_FLY_MS = 6000; // flight-freeze watchdog (see camera-bus)

interface PerfOverrides {
  fakeFps?: number;
  sustainSecs?: number;
  settleMs?: number;
  warmupMs?: number;
}

// Dev-only: seed overrides from the URL once. ?perf=<fps> feeds a synthetic FPS
// to the governor (e.g. ?perf=5 forces a full A→B→C walk); ?perfsustain / ?perfsettle
// / ?perfwarmup (all in their native units) collapse the debounce so the walk is
// observable in a few seconds. A window.__coastPerf object (set by a test's
// addInitScript) takes precedence over the URL.
const QUERY_OVERRIDES: PerfOverrides = (() => {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") return {};
  const p = new URLSearchParams(window.location.search);
  const num = (k: string) => {
    const v = p.get(k);
    if (v === null) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const out: PerfOverrides = {};
  const fps = num("perf");
  if (fps !== undefined) out.fakeFps = fps;
  const ss = num("perfsustain");
  if (ss !== undefined) out.sustainSecs = ss;
  const sm = num("perfsettle");
  if (sm !== undefined) out.settleMs = sm;
  const wm = num("perfwarmup");
  if (wm !== undefined) out.warmupMs = wm;
  return out;
})();

function devOverrides(): PerfOverrides | null {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") return null;
  const fromWindow = (window as unknown as { __coastPerf?: PerfOverrides }).__coastPerf ?? {};
  return { ...QUERY_OVERRIDES, ...fromWindow };
}

export default function FpsGovernor({
  ready,
  onEscalate,
}: {
  ready: boolean;
  onEscalate?: () => void;
}) {
  const setDpr = useThree((s) => s.setDpr);
  const viewport = useThree((s) => s.viewport);

  const fps = useRef(60);
  const readyAt = useRef<number | null>(null); // clock seconds when warm-up starts
  const belowTargetSecs = useRef(0);
  const belowFloorSecs = useRef(0);
  const lastActionMs = useRef(0); // performance.now() of the last rung
  const imperativeDpr = useRef<number | null>(null); // the ratio WE last set
  const reassertFrames = useRef(0); // frames to re-clamp DPR after a calm flip
  const rung = useRef<"full" | "dpr" | "calm" | "static">("full");
  const governorForcedCalm = useRef(false); // one-way: don't re-fight a user who toggles back to full
  const latched = useRef(false);

  useFrame((state, delta) => {
    if (imperativeDpr.current === null) imperativeDpr.current = viewport.dpr;

    // Re-assert our low DPR for a few frames after Tier B: the calm re-render
    // re-applies CoastScene's [1,1.25] ceiling, which would otherwise raise the
    // actual ratio back above what the governor chose.
    if (reassertFrames.current > 0) {
      reassertFrames.current -= 1;
      const target = Math.min(imperativeDpr.current ?? CALM_DPR_CEILING, CALM_DPR_CEILING);
      if (viewport.dpr > target + 0.001) setDpr(target);
    }

    const t = state.clock.elapsedTime;
    const ov = devOverrides();

    // measure FPS (dev hook can inject a synthetic value without stalling)
    const sampled = ov && typeof ov.fakeFps === "number" ? ov.fakeFps : delta > 0 ? 1 / delta : 60;
    fps.current = fps.current * (1 - EWMA_ALPHA) + sampled * EWMA_ALPHA;

    if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
      (window as unknown as { __fpsGovernor?: unknown }).__fpsGovernor = {
        rung: rung.current,
        fps: Math.round(fps.current),
        dpr: imperativeDpr.current,
        latched: latched.current,
      };
    }

    if (latched.current) return;
    if (!ready) return;
    if (readyAt.current === null) readyAt.current = t;

    const warmupMs = ov?.warmupMs ?? WARMUP_MS;
    if ((t - readyAt.current) * 1000 < warmupMs) return; // still warming up

    // Freeze escalation during a camera flight so the heavy Tier-B rebuild lands
    // at rest (the EWMA keeps updating; only the timers/actions pause).
    if (isCameraFlying(MAX_FLY_MS)) return;

    const sustainSecs = ov?.sustainSecs ?? SUSTAIN_SECS;
    const settleMs = ov?.settleMs ?? SETTLE_MS;

    // current rung facts, computed BEFORE the timers so the floor debt only
    // accrues once the cheap A/B levers are already in effect.
    const dpr = imperativeDpr.current ?? viewport.dpr;
    const dprExhausted = dpr <= DPR_FLOOR + 0.001;
    const abExhausted = dprExhausted && getQuality() === "calm";

    // asymmetric hysteresis: accrue while bad, decay twice as fast while good.
    // belowTargetSecs drives the cheap A/B levers; belowFloorSecs — the ONLY path
    // to terminal static — accrues only once A+B are exhausted, so a device that
    // recovers to ≥FLOOR after calm is applied is never wrongly sent to static.
    belowTargetSecs.current = Math.max(
      0,
      belowTargetSecs.current + (fps.current < TARGET_FPS ? delta : -2 * delta),
    );
    belowFloorSecs.current = abExhausted
      ? Math.max(0, belowFloorSecs.current + (fps.current < FLOOR_FPS ? delta : -2 * delta))
      : 0;

    const sinceAction = performance.now() - lastActionMs.current;
    if (sinceAction < settleMs) return;

    if (!abExhausted) {
      // cheap levers: sustained below TARGET → take the next A or B step
      if (belowTargetSecs.current < sustainSecs) return;
      if (!dprExhausted) {
        const next = Math.max(DPR_FLOOR, dpr * DPR_STEP);
        imperativeDpr.current = next;
        setDpr(next);
        rung.current = "dpr";
        if (process.env.NODE_ENV !== "production") console.log(`[perf] DPR → ${next.toFixed(2)} (fps≈${Math.round(fps.current)})`);
        lastActionMs.current = performance.now();
        belowTargetSecs.current = 0;
      } else if (!governorForcedCalm.current) {
        // DPR floored → flip to calm, in-memory only (never persist a governor
        // decision over the visitor's saved preference).
        setQuality("calm", false); // Terrain/Water/Trees/FarLayer rebuild smaller
        governorForcedCalm.current = true;
        reassertFrames.current = 8; // keep our low DPR through the calm re-render
        rung.current = "calm";
        if (process.env.NODE_ENV !== "production") console.log(`[perf] quality → calm (fps≈${Math.round(fps.current)})`);
        lastActionMs.current = performance.now();
        belowTargetSecs.current = 0;
      }
      // else: we already forced calm and the user manually bounced back to full —
      // respect the human; take no further geometry action this session.
      return;
    }

    // A and B are exhausted. Only a SUSTAINED FLOOR breach reaches terminal static.
    if (belowFloorSecs.current >= sustainSecs) {
      latched.current = true;
      rung.current = "static";
      if (process.env.NODE_ENV !== "production") console.log(`[perf] escalate → static (fps≈${Math.round(fps.current)})`);
      onEscalate?.();
    } else {
      // weak but acceptable (≥FLOOR after calm) — leave it on the live scene
      belowTargetSecs.current = 0;
      belowFloorSecs.current = 0;
    }
  });

  return null;
}
