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

if (typeof window !== "undefined") {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "calm" || v === "full") current = v;
    else if (window.innerWidth < 768 || isLowPower()) current = "calm"; // small / mobile / weak → calm
  } catch {
    /* ignore */
  }
}

export function getQuality(): Quality {
  return current;
}

export function setQuality(q: Quality) {
  if (q === current) return;
  current = q;
  try {
    localStorage.setItem(KEY, q);
  } catch {
    /* ignore */
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
