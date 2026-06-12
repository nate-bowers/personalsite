"use client";

import { useEffect, useRef, useState } from "react";
import { loadTerrain, type TerrainData } from "@/lib/terrain";
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
  const [ready, setReady] = useState(false);

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

  return (
    <div ref={wrapperRef} className="fixed inset-0 z-0">
      <div
        className="h-full w-full transition-opacity duration-700 ease-out"
        style={{ opacity: ready ? 1 : 0 }}
      >
        {data && (
          <CoastScene
            data={data}
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
