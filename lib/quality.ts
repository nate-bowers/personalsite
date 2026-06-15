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

if (typeof window !== "undefined") {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "calm" || v === "full") current = v;
    else if (window.innerWidth < 768) current = "calm"; // small / mobile defaults to calm
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
