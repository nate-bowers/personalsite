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
  levis: { lng: -122.22, lat: 37.43 }, // moved south (toward camera) onto open flats for max visibility, clear of Hoover behind
  transamerica: { lng: -122.4028, lat: 37.775 }, // a little south of its real spot
};

export default function Landmarks({ data }: { data: TerrainData }) {
  const at = useMemo(() => {
    const ground = (lng: number, lat: number): V3 => {
      const [x, z] = lngLatToScene(data.meta, lng, lat);
      return [x, Math.max(0, terrainYAtScene(data, x, z)), z];
    };
    // The stadium has a wide flat footprint; seat its base on the HIGHEST point
    // beneath that footprint so the bowl never sinks into a rise on one side.
    const groundMax = (lng: number, lat: number, r: number): V3 => {
      const [x, z] = lngLatToScene(data.meta, lng, lat);
      let y = terrainYAtScene(data, x, z);
      for (let a = 0; a < Math.PI * 2 - 0.01; a += Math.PI / 4) {
        for (const rr of [r * 0.6, r]) {
          y = Math.max(y, terrainYAtScene(data, x + Math.cos(a) * rr, z + Math.sin(a) * rr));
        }
      }
      return [x, Math.max(0, y), z];
    };
    return {
      hoover: ground(SPOTS.hoover.lng, SPOTS.hoover.lat),
      campanile: ground(SPOTS.campanile.lng, SPOTS.campanile.lat),
      levis: groundMax(SPOTS.levis.lng, SPOTS.levis.lat, 1.4),
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
