"use client";

import { useSyncExternalStore } from "react";

/**
 * Scene quality, toggled by the "calmer seas" control. The 3D fallback (2D
 * ocean) already covers no-WebGL / reduced-motion / mobile; this is for the
 * middle class of laptops that CAN run the 3D scene but not at 60fps — it
 * roughly halves the heavy geometry (tree counts + mesh segments) on demand.
 * Module-level store so the in-Canvas components and the DOM control share it.
 */

export type Quality = "full" | "calm";

const KEY = "coast.quality";
let current: Quality = "full";
const listeners = new Set<() => void>();

// Weak machines: few cores or little memory → default to the lighter tier so the
// scene renders faster and presents before the load-timeout drops it to static.
function isLowPower(): boolean {
  if (typeof navigator === "undefined") return false;
  const cores = navigator.hardwareConcurrency;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return (typeof cores === "number" && cores <= 4) || (typeof mem === "number" && mem <= 4);
}

// A fast GPU HINT (not a gate): software rasterizers and known-weak integrated
// GPUs can pass the cores/memory check yet crawl at full fidelity. We read the
// unmasked renderer string and seed "calm" for the obvious software cases — a
// head start so the runtime FpsGovernor isn't the visitor's first few seconds of
// jank. It only ever LOWERS the start tier (never to static), and returns false
// on an empty / privacy-masked string so an unknown GPU is never punished.
function gpuIsWeak(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (!gl) return false;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    if (!ext) return false;
    const r = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || "").toLowerCase();
    if (!r) return false; // masked / unknown → no penalty
    return /swiftshader|llvmpipe|softpipe|software|basic render|paravirtual|microsoft basic|mesa\b.*soft/.test(r);
  } catch {
    return false;
  }
}

if (typeof window !== "undefined") {
  try {
    // Dev hook: ?gpu=weak simulates a weak-GPU device for verifying the seed.
    const forceWeakGpu =
      process.env.NODE_ENV !== "production" &&
      new URLSearchParams(window.location.search).get("gpu") === "weak";
    const v = localStorage.getItem(KEY);
    if (v === "calm" || v === "full") current = v; // an explicit user choice always wins
    else if (window.innerWidth < 768 || isLowPower() || forceWeakGpu || gpuIsWeak()) current = "calm";
  } catch {
    /* ignore */
  }
}

export function getQuality(): Quality {
  return current;
}

// persist=false is for the runtime FpsGovernor: a measured-FPS downgrade is a
// session decision and must NEVER rewrite the visitor's saved preference (an
// explicit "full" choice has to still win on the next load).
export function setQuality(q: Quality, persist = true) {
  if (q === current) return;
  current = q;
  if (persist) {
    try {
      localStorage.setItem(KEY, q);
    } catch {
      /* ignore */
    }
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Reactive read for components; re-renders on toggle. */
export function useQuality(): Quality {
  return useSyncExternalStore(subscribe, () => current, () => "full");
}

/** Multiplier for instance counts / a coarser segment count in calm mode. */
export function qScale(q: Quality, full: number, calm: number): number {
  return q === "calm" ? calm : full;
}
