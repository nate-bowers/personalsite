"use client";

import { useMemo } from "react";
import { lngLatToScene, terrainYAtScene, type TerrainData } from "@/lib/terrain";
import HooverTower from "./HooverTower";
import Campanile from "./Campanile";
import LevisStadium from "./LevisStadium";
import TransamericaPyramid from "./TransamericaPyramid";

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
  hoover: { lng: -122.283, lat: 37.41 }, // in front of the stadium and centered on its exposed near corner
  campanile: { lng: -122.235, lat: 37.858 }, // a little southeast
  levis: { lng: -122.12, lat: 37.43 }, // nudged well east off Hoover (which sits just west) so the two don't stack on screen
  transamerica: { lng: -122.4028, lat: 37.775 }, // a little south of its real spot
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
      transamerica: ground(SPOTS.transamerica.lng, SPOTS.transamerica.lat),
    };
  }, [data]);

  return (
    <group>
      <HooverTower pos={at.hoover} />
      <Campanile pos={at.campanile} />
      <LevisStadium pos={at.levis} />
      <TransamericaPyramid pos={at.transamerica} />
    </group>
  );
}
