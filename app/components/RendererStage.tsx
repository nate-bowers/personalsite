"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import SeaSky from "./SeaSky";
import Ocean from "./Ocean";
import Controls from "./Controls";
import { loadTerrain } from "@/lib/terrain";
import type { Conditions } from "@/lib/ndbc";

export type RenderMode = "loading" | "2d" | "3d";

const ModeContext = createContext<RenderMode>("loading");
export const useRenderMode = () => useContext(ModeContext);

// The entire three.js scene is code-split behind the landing frame.
const CoastBackground = dynamic(() => import("./three/CoastBackground"), { ssr: false });

/**
 * Decides the renderer once on the client (DESIGN-PHASE2.md §3): the 3D coast only
 * when WebGL2 is available AND not prefers-reduced-motion AND the viewport is >=768px;
 * everything else gets the v1 2D ocean. The decision is exposed via context so panels
 * and the buoy layer can adapt (bottom-sheet vs side-sheet, DOM buoys vs 3D buoys).
 */
function detectMode(): RenderMode {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "2d";
  if (window.innerWidth < 768) return "2d";
  try {
    if (!document.createElement("canvas").getContext("webgl2")) return "2d";
  } catch {
    return "2d";
  }
  return "3d";
}

// Capability is detected once on the client; useSyncExternalStore gives the correct
// server ("loading") vs client snapshot without a setState-in-effect.
let cachedMode: RenderMode | null = null;
const clientMode = (): RenderMode => {
  if (cachedMode === null) cachedMode = detectMode();
  return cachedMode;
};
const subscribe = () => () => {};

export default function RendererStage({
  conditions,
  children,
}: {
  conditions: Conditions;
  children: React.ReactNode;
}) {
  const mode = useSyncExternalStore<RenderMode>(subscribe, clientMode, () => "loading");

  // "Take the controls" can override the live data feeding the ocean.
  const [override, setOverride] = useState<Conditions | null>(null);
  const effective = override ?? conditions;

  // Preload the terrain assets in parallel with the lazy three.js chunk — by
  // the time the chunk evaluates, the heightmap fetch is already in flight.
  useEffect(() => {
    if (mode === "3d") void loadTerrain().catch(() => {});
  }, [mode]);

  return (
    <ModeContext.Provider value={mode}>
      {/* The golden-hour gradient is the base layer and the 3D streaming placeholder. */}
      <SeaSky />
      {/* The renderer decision happens once, before either stage paints: the 2D
          ocean mounts ONLY when 2D is the decision — never as a 3D pre-state. */}
      {mode === "2d" && <Ocean conditions={effective} />}
      {/* z-0 wrapper (owned by CoastBackground) so the canvas receives pointer events;
          the chrome (nav z-15, header z-20, panel z-30) stays above it. */}
      {mode === "3d" && <CoastBackground conditions={effective} />}
      {mode === "loading" && (
        <div aria-hidden className="pointer-events-none fixed inset-x-0 bottom-[42%] z-0 flex justify-center">
          <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-[color:var(--ink)]/60">
            establishing conditions...
          </span>
        </div>
      )}
      {children}
      {mode !== "loading" && <Controls live={conditions} override={override} setOverride={setOverride} />}
    </ModeContext.Provider>
  );
}
