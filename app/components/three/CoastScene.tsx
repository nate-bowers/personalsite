"use client";

import type { RefObject } from "react";
import { Canvas } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import type { Conditions } from "@/lib/ndbc";
import type { TerrainData } from "@/lib/terrain";
import Terrain from "./Terrain";
import Trees from "./Trees";
import Pond from "./Pond";
import Landmarks from "./Landmarks";
import Water from "./Water";
import SkyDome from "./SkyDome";
import Clouds from "./Clouds";
import Birds from "./Birds";
import Ferry from "./Ferry";
import Buoys from "./Buoys";
import CameraRig from "./CameraRig";

// Direction TO the sun: low in the west — golden-hour sunset.
const SUN_DIR: [number, number, number] = [-1, 0.22, 0.12];

export default function CoastScene({
  data,
  conditions,
  eventSource,
}: {
  data: TerrainData;
  conditions: Conditions;
  eventSource?: RefObject<HTMLElement | null>;
}) {
  return (
    <Canvas
      eventSource={eventSource as RefObject<HTMLElement>}
      eventPrefix="client"
      shadows
      camera={{ position: [-10, 8.5, 9.5], fov: 50, near: 0.1, far: 400 }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
    >
      <color attach="background" args={["#e7ab73"]} />
      <fogExp2 attach="fog" args={["#e7ab73", 0.012]} />
      <hemisphereLight args={["#9a90c0", "#6a5236", 0.95]} />
      <directionalLight
        position={[-42, 9, 10]}
        intensity={2.95}
        color="#ffd9a0"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={70}
        shadow-camera-left={-13}
        shadow-camera-right={13}
        shadow-camera-top={13}
        shadow-camera-bottom={-13}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
      />
      <SkyDome sunDir={SUN_DIR} />
      <Clouds />
      <Birds />
      <Terrain data={data} />
      <Ferry data={data} conditions={conditions} />
      <Trees data={data} />
      <Pond data={data} />
      <Landmarks data={data} />
      <Water conditions={conditions} sunDir={SUN_DIR} />
      <Buoys terrain={data} conditions={conditions} />
      <CameraRig anchors={data.anchors} />
      <EffectComposer>
        <Bloom intensity={0.62} luminanceThreshold={0.62} luminanceSmoothing={0.2} mipmapBlur />
      </EffectComposer>
    </Canvas>
  );
}
