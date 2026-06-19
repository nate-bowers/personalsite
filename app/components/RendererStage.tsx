"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import SeaSky from "./SeaSky";
import StaticCoast from "./StaticCoast";
import Controls from "./Controls";
import Establishing from "./Establishing";
import { loadTerrain } from "@/lib/terrain";
import type { Conditions } from "@/lib/ndbc";

/**
 * One scene, three fidelity tiers (DESIGN-PHASE2.md §3) — never a different site:
 *  - "scene":   the live 3D coast. quality "full" on desktop, "calm" on small /
 *               mobile. motion=false (reduced-motion) renders a single frozen frame.
 *  - "static":  no WebGL2 at all, or the scene failed / never presented a frame →
 *               a still image of the SAME coast with DOM buoys. Not a 2D ocean.
 *  - "loading": pre-hydration / while the three.js chunk streams.
 */
export type RenderTier = "loading" | "scene" | "static";
export interface RenderState {
  tier: RenderTier;
  compact: boolean; // narrow viewport → bottom-sheet panels
  webgl2: boolean; // device can run the live scene (offer the opt-in from static)
}

const LOADING: RenderState = { tier: "loading", compact: false, webgl2: false };

const Ctx = createContext<RenderState>(LOADING);
export const useRenderState = () => useContext(Ctx);
/** Back-compat: components that only care about the tier. */
export const useRenderMode = () => useContext(Ctx).tier;

// The three.js scene is code-split behind the landing frame; while the chunk
// streams, the scene area keeps the branded establishing state.
const CoastBackground = dynamic(() => import("./three/CoastBackground"), {
  ssr: false,
  loading: () => <Establishing />,
});

/**
 * Capability + preference detection, once on the client. We run the SAME coast
 * scene everywhere we can: only a total lack of WebGL2 (or a load failure) drops
 * to the static image. Small screens get the scene at "calm" quality;
 * reduced-motion gets a frozen frame — never a foreign renderer.
 */
function detectRender(): RenderState {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const compact = window.innerWidth < 768;
  let webgl2 = false;
  try {
    webgl2 = !!document.createElement("canvas").getContext("webgl2");
  } catch {
    webgl2 = false;
  }
  // Dev-only escape hatch for verifying tiers: ?render=static | ?render=scene.
  if (process.env.NODE_ENV !== "production") {
    const force = new URLSearchParams(window.location.search).get("render");
    if (force === "static") return { tier: "static", compact, webgl2 };
  }
  // No WebGL2, or the visitor asked for reduced motion → the still image of the
  // same coast (motion-free, bulletproof). Otherwise the live scene — at "calm"
  // quality on small / mobile / weak machines (seeded in lib/quality).
  if (!webgl2 || reduced) return { tier: "static", compact, webgl2 };
  return { tier: "scene", compact, webgl2 };
}

// Detected once on the client; useSyncExternalStore gives the correct
// server ("loading") vs client snapshot without a setState-in-effect.
let cached: RenderState | null = null;
const clientSnap = (): RenderState => (cached ??= detectRender());
const subscribe = () => () => {};

export default function RendererStage({
  conditions,
  children,
}: {
  conditions: Conditions;
  children: React.ReactNode;
}) {
  const detected = useSyncExternalStore<RenderState>(subscribe, clientSnap, () => LOADING);
  // Honest degradation: if the 3D chunk/terrain can't load or never presents a
  // frame, fall to the static image of the same scene — not a stall, not an ocean.
  const [sceneFailed, setSceneFailed] = useState(false);
  // Manual opt-in from the static tier: a visitor whose device CAN run WebGL2 but
  // landed on static (slow first load, or reduced-motion) can ask for the scene.
  const [forceScene, setForceScene] = useState(false);
  const tier: RenderTier =
    forceScene && detected.webgl2 && !sceneFailed
      ? "scene"
      : sceneFailed && detected.tier === "scene"
        ? "static"
        : detected.tier;
  const state: RenderState = { ...detected, tier };

  // Preload terrain in parallel with the lazy three.js chunk.
  useEffect(() => {
    if (tier === "scene") void loadTerrain().catch(() => {});
  }, [tier]);

  return (
    <Ctx.Provider value={state}>
      {/* Golden-hour gradient: base layer + streaming placeholder. */}
      <SeaSky />
      {/* No WebGL2 / scene failed → still image of the same coast + DOM buoys.
          If the device can actually run WebGL2, offer to load the live scene. */}
      {tier === "static" && (
        <StaticCoast
          onEnter={
            detected.webgl2
              ? () => {
                  setSceneFailed(false);
                  setForceScene(true);
                }
              : undefined
          }
        />
      )}
      {/* z-0 wrapper (owned by CoastBackground) so the canvas receives pointer
          events; the chrome (nav z-15, header z-20, panel z-30) stays above it. */}
      {tier === "scene" && (
        <CoastBackground conditions={conditions} onUnavailable={() => setSceneFailed(true)} />
      )}
      {tier === "loading" && <Establishing />}
      {children}
      {tier !== "loading" && <Controls />}
    </Ctx.Provider>
  );
}
