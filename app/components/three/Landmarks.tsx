"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { lngLatToScene, terrainYAtScene, type TerrainData } from "@/lib/terrain";

/**
 * Iconic landmarks at their real positions, rendered larger than life (the
 * same scale license as the geography, DESIGN-PHASE2.md §4) so each is
 * identifiable at a glance from the home camera:
 *  - Hoover Tower (Stanford): sandstone shaft, arched belfry, red-tile cap
 *  - Sather Tower / the Campanile (UC Berkeley): white granite, green spire
 *  - Levi's Stadium (Santa Clara): low bowl, twin white roof canopies, red trim
 * The Golden Gate Bridge lives in its own component.
 */

type V3 = [number, number, number];

function HooverTower({ pos }: { pos: V3 }) {
  return (
    <group position={pos} scale={0.45}>
      {/* plinth */}
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[0.26, 0.12, 0.26]} />
        <meshStandardMaterial color="#cdba8d" roughness={0.85} />
      </mesh>
      {/* slender sandstone shaft */}
      <mesh position={[0, 0.85, 0]}>
        <boxGeometry args={[0.16, 1.5, 0.16]} />
        <meshStandardMaterial color="#ddc99c" roughness={0.85} emissive="#ddc99c" emissiveIntensity={0.3} />
      </mesh>
      {/* belfry block */}
      <mesh position={[0, 1.66, 0]}>
        <boxGeometry args={[0.21, 0.26, 0.21]} />
        <meshStandardMaterial color="#d3bf90" roughness={0.85} />
      </mesh>
      {/* dark arched openings, all four faces */}
      <mesh position={[0, 1.66, 0]}>
        <boxGeometry args={[0.215, 0.16, 0.13]} />
        <meshStandardMaterial color="#5b4a32" roughness={0.95} />
      </mesh>
      <mesh position={[0, 1.66, 0]}>
        <boxGeometry args={[0.13, 0.16, 0.215]} />
        <meshStandardMaterial color="#5b4a32" roughness={0.95} />
      </mesh>
      {/* cornice */}
      <mesh position={[0, 1.81, 0]}>
        <boxGeometry args={[0.25, 0.04, 0.25]} />
        <meshStandardMaterial color="#e2cfa1" roughness={0.85} />
      </mesh>
      {/* red-tile hipped cap */}
      <mesh position={[0, 1.96, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[0.2, 0.28, 4]} />
        <meshStandardMaterial color="#a4502f" roughness={0.7} emissive="#a4502f" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

function Campanile({ pos }: { pos: V3 }) {
  return (
    <group position={pos} scale={0.45}>
      {/* white granite shaft, slimmer than Hoover */}
      <mesh position={[0, 0.8, 0]}>
        <boxGeometry args={[0.13, 1.6, 0.13]} />
        <meshStandardMaterial color="#e9e4d8" roughness={0.8} emissive="#e9e4d8" emissiveIntensity={0.32} />
      </mesh>
      {/* clock band */}
      <mesh position={[0, 1.52, 0]}>
        <boxGeometry args={[0.145, 0.1, 0.145]} />
        <meshStandardMaterial color="#cfc9bb" roughness={0.8} />
      </mesh>
      {/* open lantern / belfry */}
      <mesh position={[0, 1.7, 0]}>
        <boxGeometry args={[0.125, 0.22, 0.125]} />
        <meshStandardMaterial color="#4f463a" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.7, 0]}>
        <boxGeometry args={[0.15, 0.18, 0.04]} />
        <meshStandardMaterial color="#e9e4d8" roughness={0.8} emissive="#e9e4d8" emissiveIntensity={0.32} />
      </mesh>
      {/* steep green-bronze pyramid spire — the Campanile signature */}
      <mesh position={[0, 1.99, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[0.115, 0.38, 4]} />
        <meshStandardMaterial color="#5e7d62" roughness={0.6} metalness={0.15} emissive="#5e7d62" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

function LevisStadium({ pos }: { pos: V3 }) {
  return (
    <group position={pos} scale={1.1} rotation={[0, 0.35, 0]}>
      <group scale={[1.45, 1, 1.05]}>
        {/* seating bowl */}
        <mesh position={[0, 0.12, 0]}>
          <cylinderGeometry args={[0.33, 0.26, 0.24, 24, 1, true]} />
          <meshStandardMaterial color="#9a938a" roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
        {/* 49ers-red upper band */}
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.29, 0.32, 0.08, 24, 1, true]} />
          <meshStandardMaterial color="#9e2b25" roughness={0.85} side={THREE.DoubleSide} emissive="#9e2b25" emissiveIntensity={0.3} />
        </mesh>
        {/* field */}
        <mesh position={[0, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.26, 24]} />
          <meshStandardMaterial color="#3f8f39" roughness={1} />
        </mesh>
      </group>
      {/* twin white roof canopies — the identifiable silhouette */}
      <mesh position={[0, 0.3, -0.3]}>
        <boxGeometry args={[0.62, 0.045, 0.2]} />
        <meshStandardMaterial color="#ece6da" roughness={0.6} emissive="#ece6da" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[0, 0.3, 0.3]}>
        <boxGeometry args={[0.62, 0.045, 0.2]} />
        <meshStandardMaterial color="#ece6da" roughness={0.6} emissive="#ece6da" emissiveIntensity={0.3} />
      </mesh>
      {/* suite tower under the south canopy */}
      <mesh position={[0, 0.17, -0.31]}>
        <boxGeometry args={[0.56, 0.22, 0.12]} />
        <meshStandardMaterial color="#b8b0a4" roughness={0.8} />
      </mesh>
    </group>
  );
}

const SPOTS = {
  hoover: { lng: -122.1661, lat: 37.4275 },
  campanile: { lng: -122.2578, lat: 37.8721 },
  levis: { lng: -121.9696, lat: 37.4033 },
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
