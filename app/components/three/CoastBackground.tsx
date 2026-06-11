"use client";

import { useEffect, useRef, useState } from "react";
import { loadTerrain, type TerrainData } from "@/lib/terrain";
import type { Conditions } from "@/lib/ndbc";
import CoastScene from "./CoastScene";

/**
 * Loads the terrain assets, then renders the 3D scene. Owns the full-screen wrapper
 * and passes it to the Canvas as the event source so R3F pointer events (buoy clicks,
 * hover) fire even though drei <Html> labels are portaled over the canvas. Returns the
 * gradient placeholder (via null) until the heightmap is fetched. This whole module is
 * dynamically imported (ssr:false) so the three bundle stays off the first-paint path.
 */
export default function CoastBackground({ conditions }: { conditions: Conditions }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<TerrainData | null>(null);

  useEffect(() => {
    let alive = true;
    loadTerrain()
      .then((d) => {
        if (alive) setData(d);
      })
      .catch(() => {
        /* terrain unavailable -> stays on the 2D gradient */
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div ref={wrapperRef} className="fixed inset-0 z-0">
      {data && <CoastScene data={data} conditions={conditions} eventSource={wrapperRef} />}
    </div>
  );
}
