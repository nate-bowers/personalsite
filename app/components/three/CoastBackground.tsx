"use client";

import { useEffect, useRef, useState } from "react";
import { loadTerrain, loadFarTerrain, type TerrainData, type FarData } from "@/lib/terrain";
import type { Conditions } from "@/lib/ndbc";
import CoastScene from "./CoastScene";

/**
 * Owns the 3D loading sequence (FIX 5b): while the terrain streams and the
 * first frames render, the scene area holds the branded minimal state — the
 * SeaSky gradient (rendered by RendererStage underneath) plus a quiet
 * "establishing conditions..." line in mono. When the scene has actually
 * presented frames it cross-fades in. No intermediate pops, no 2D-then-3D
 * swap.
 *
 * Also owns the full-screen wrapper passed to the Canvas as its event source
 * so R3F pointer events (buoy clicks, hover) fire even though drei <Html>
 * labels are portaled over the canvas.
 */
export default function CoastBackground({
  conditions,
  onUnavailable,
}: {
  conditions: Conditions;
  onUnavailable?: () => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<TerrainData | null>(null);
  const [far, setFar] = useState<FarData | null>(null);
  const [ready, setReady] = useState(false);

  // Secondary tier: the surrounding California topography streams in on idle
  // AFTER the scene has presented — purely to extend the land to the fog wall;
  // it must never compete with the initial load. Failure is cosmetic: the
  // haze plain simply stays.
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    const kick = () => {
      loadFarTerrain()
        .then((f) => {
          if (alive) setFar(f);
        })
        .catch(() => {});
    };
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    };
    if (w.requestIdleCallback) w.requestIdleCallback(kick, { timeout: 4000 });
    else setTimeout(kick, 1500);
    return () => {
      alive = false;
    };
  }, [ready]);

  useEffect(() => {
    let alive = true;
    let retried = false;
    const attempt = () =>
      loadTerrain()
        .then((d) => {
          if (alive) setData(d);
        })
        .catch(() => {
          // one retry, then hand the stage back honestly (2D fallback)
          // rather than stranding the visitor on "establishing conditions..."
          if (!alive) return;
          if (!retried) {
            retried = true;
            setTimeout(attempt, 2500);
          } else {
            onUnavailable?.();
          }
        });
    attempt();
    return () => {
      alive = false;
    };
  }, [onUnavailable]);

  // Safety net: if the scene never presents a frame within the budget (a stalled
  // chunk, a wedged WebGL context, a device that just can't), hand off to the
  // static image instead of stranding the visitor on "establishing conditions...".
  useEffect(() => {
    if (ready) return;
    const t = setTimeout(() => onUnavailable?.(), 8000);
    return () => clearTimeout(t);
  }, [ready, onUnavailable]);

  return (
    <div ref={wrapperRef} className="fixed inset-0 z-0">
      <div
        className="h-full w-full transition-opacity duration-700 ease-out"
        style={{ opacity: ready ? 1 : 0 }}
      >
        {data && (
          <CoastScene
            data={data}
            far={far}
            conditions={conditions}
            eventSource={wrapperRef}
            onReady={() => setReady(true)}
          />
        )}
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-[42%] flex justify-center transition-opacity duration-500"
        style={{ opacity: ready ? 0 : 1 }}
      >
        <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-[color:var(--ink)]/60">
          establishing conditions...
        </span>
      </div>
    </div>
  );
}
