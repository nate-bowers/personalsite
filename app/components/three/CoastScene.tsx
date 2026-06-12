"use client";

import { useMemo, useRef, type RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import type { Conditions } from "@/lib/ndbc";
import type { TerrainData } from "@/lib/terrain";
import { computeOpenness } from "@/lib/openness";
import { installHeightFog, TOKENS, FOG } from "./atmosphere";
import Terrain from "./Terrain";
import Trees from "./Trees";
import GoldenGate from "./GoldenGate";
import PlaceNames from "./PlaceNames";
import Water from "./Water";
import SkyDome from "./SkyDome";
import Clouds from "./Clouds";
import Birds from "./Birds";
import Ferry from "./Ferry";
import Buoys from "./Buoys";
import CameraRig from "./CameraRig";

// Replace three's fog with the shared height fog before any material compiles.
installHeightFog();

// Direction TO the sun: low over the water in frame-left of the NE-looking
// default shot (~34° left of the view axis, inside the 39.7° half-FOV), so
// the sun disc, glitter path and bloom are actually reachable from the rails.
// Compass-bent north-of-west by artistic license — the same compression
// license as the geography. Locked golden hour.
const SUN_DIR: [number, number, number] = [-0.2, 0.02, -0.98];

/** Calls onReady after the first real frames have been presented. */
function ReadySignal({ onReady }: { onReady: () => void }) {
  const frames = useRef(0);
  const fired = useRef(false);
  useFrame(() => {
    if (fired.current) return;
    frames.current += 1;
    if (frames.current >= 3) {
      fired.current = true;
      onReady();
    }
  });
  return null;
}

export default function CoastScene({
  data,
  conditions,
  eventSource,
  onReady,
}: {
  data: TerrainData;
  conditions: Conditions;
  eventSource?: RefObject<HTMLElement | null>;
  onReady: () => void;
}) {
  // Real-bathymetry swell exposure — shared by the water mesh, buoys and ferry.
  const openness = useMemo(() => computeOpenness(data), [data]);

  return (
    <Canvas
      eventSource={eventSource as RefObject<HTMLElement>}
      eventPrefix="client"
      camera={{ position: [-5.6, 7.2, 13.2], fov: 50, near: 0.1, far: 1400 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true }}
      onCreated={(state) => {
        // debug hook for the visual-verification loop
        (window as unknown as Record<string, unknown>).__r3f_state = state;
      }}
    >
      {/* fogExp2 turns USE_FOG on for standard materials; the patched chunks
          (installHeightFog) supply the actual formula + constants */}
      <fogExp2 attach="fog" args={[TOKENS.fog, FOG.DENSITY]} />
      <hemisphereLight args={["#8d7aa8", "#6b5238", 1.05]} />
      <directionalLight position={[-13, 2, -62]} intensity={2.4} color={TOKENS.sunGlow} />
      <SkyDome sunDir={SUN_DIR} />
      <Clouds />
      <Birds />
      <Terrain data={data} sunDir={SUN_DIR} />
      <Trees data={data} />
      <GoldenGate data={data} />
      <PlaceNames data={data} />
      <Ferry data={data} conditions={conditions} openness={openness} />
      <Water conditions={conditions} sunDir={SUN_DIR} openness={openness} />
      <Buoys terrain={data} conditions={conditions} openness={openness} />
      <CameraRig anchors={data.anchors} />
      <ReadySignal onReady={onReady} />
      <EffectComposer>
        <Bloom intensity={0.5} luminanceThreshold={0.82} luminanceSmoothing={0.3} mipmapBlur />
      </EffectComposer>
    </Canvas>
  );
}
