"use client";

import { useMemo } from "react";
import { lngLatToScene, terrainYAtScene, type TerrainData } from "@/lib/terrain";
import HooverTower from "./HooverTower";
import Campanile from "./Campanile";
import LevisStadium from "./LevisStadium";

/**
 * Iconic landmarks at their real positions, rendered larger than life (the
 * same scale license as the geography) so each is identifiable at a glance.
 * Each model lives in its own file. The Golden Gate Bridge has its own
 * component too (GoldenGate.tsx).
 */

type V3 = [number, number, number];

// hoover + levis are nudged a few km from their true addresses onto open,
// camera-facing ground (foothill bench / bayshore flats) so they stay visible
const SPOTS = {
  hoover: { lng: -122.195, lat: 37.405 },
  campanile: { lng: -122.2578, lat: 37.8721 },
  levis: { lng: -121.95, lat: 37.40 },
};

export default function Landmarks({ data }: { data: TerrainData }) {
  const at = useMemo(() => {
    const ground = (lng: number, lat: number): V3 => {
      const [x, z] = lngLatToScene(data.meta, lng, lat);
      return [x, Math.max(0, terrainYAtScene(data, x, z)), z];
    };
    return {
      hoover: ground(SPOTS.hoover.lng, SPOTS.hoover.lat),
      campanile: ground(SPOTS.campanile.lng, SPOTS.campanile.lat),
      levis: ground(SPOTS.levis.lng, SPOTS.levis.lat),
    };
  }, [data]);

  return (
    <group>
      <HooverTower pos={at.hoover} />
      <Campanile pos={at.campanile} />
      <LevisStadium pos={at.levis} />
    </group>
  );
}
