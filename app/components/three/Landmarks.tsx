"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { lngLatToScene, terrainYAtScene, type TerrainData } from "@/lib/terrain";

type V3 = [number, number, number];

function Cable({ a, b, sag }: { a: V3; b: V3; sag: number }) {
  const geo = useMemo(() => {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const mid = va.clone().add(vb).multiplyScalar(0.5);
    mid.y -= sag;
    const curve = new THREE.QuadraticBezierCurve3(va, mid, vb);
    return new THREE.TubeGeometry(curve, 30, 0.014, 6, false);
  }, [a, b, sag]);
  return (
    <mesh geometry={geo} castShadow>
      <meshStandardMaterial color="#e35e30" roughness={0.6} />
    </mesh>
  );
}

function Suspenders({ a, b, sag, deckY, x }: { a: V3; b: V3; sag: number; deckY: number; x: number }) {
  const rods = useMemo(() => {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const mid = va.clone().add(vb).multiplyScalar(0.5);
    mid.y -= sag;
    const curve = new THREE.QuadraticBezierCurve3(va, mid, vb);
    const out: { y: number; z: number; h: number }[] = [];
    for (let i = 1; i < 12; i++) {
      const p = curve.getPoint(i / 12);
      const h = p.y - deckY;
      if (h > 0.04) out.push({ y: deckY + h / 2, z: p.z, h });
    }
    return out;
  }, [a, b, sag, deckY]);
  return (
    <>
      {rods.map((r, i) => (
        <mesh key={i} position={[x, r.y, r.z]}>
          <cylinderGeometry args={[0.005, 0.005, r.h, 4]} />
          <meshStandardMaterial color="#e35e30" roughness={0.6} />
        </mesh>
      ))}
    </>
  );
}

/** Golden Gate Bridge: art-deco towers, deck, main cables + vertical suspenders.
 * Spans the carved strait along z (towers land on the shores). */
function GoldenGate({ pos }: { pos: V3 }) {
  const towerH = 0.92;
  const span = 1.0;
  const deckY = 0.4;
  const tower = (z: number) => (
    <group position={[0, 0, z]}>
      {[-0.075, 0.075].map((dz, i) => (
        <mesh key={i} position={[0, towerH / 2, dz]} castShadow>
          <boxGeometry args={[0.085, towerH, 0.06]} />
          <meshStandardMaterial color="#e35e30" roughness={0.55} />
        </mesh>
      ))}
      {[0.32, 0.52, 0.72, 0.95].map((f, i) => (
        <mesh key={i} position={[0, towerH * f, 0]} castShadow>
          <boxGeometry args={[0.1, 0.045, 0.2]} />
          <meshStandardMaterial color="#e35e30" roughness={0.55} />
        </mesh>
      ))}
    </group>
  );
  return (
    <group position={pos} scale={1.2}>
      <mesh position={[0, deckY, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.13, 0.045, span + 0.5]} />
        <meshStandardMaterial color="#c4542f" roughness={0.7} />
      </mesh>
      {tower(-span / 2)}
      {tower(span / 2)}
      <Cable a={[0.05, towerH, -span / 2]} b={[0.05, towerH, span / 2]} sag={towerH - deckY - 0.08} />
      <Cable a={[-0.05, towerH, -span / 2]} b={[-0.05, towerH, span / 2]} sag={towerH - deckY - 0.08} />
      <Suspenders a={[0.05, towerH, -span / 2]} b={[0.05, towerH, span / 2]} sag={towerH - deckY - 0.08} deckY={deckY} x={0.05} />
      <Suspenders a={[-0.05, towerH, -span / 2]} b={[-0.05, towerH, span / 2]} sag={towerH - deckY - 0.08} deckY={deckY} x={-0.05} />
    </group>
  );
}

function Building({ x, z, h, w, color }: { x: number; z: number; h: number; w: number; color: string }) {
  return (
    <mesh position={[x, h / 2, z]} castShadow receiveShadow>
      <boxGeometry args={[w, h, w]} />
      <meshStandardMaterial color={color} roughness={0.85} />
    </mesh>
  );
}

/** San Francisco skyline — a dense cluster with a sleek Salesforce Tower (tapered
 * obelisk + glowing crown) and the Transamerica Pyramid (white spire + wings). */
function SanFrancisco({ pos }: { pos: V3 }) {
  const grey = ["#9a8f82", "#ab9f90", "#8c8175", "#b3a797", "#a59a8b", "#bdb2a2"];
  const b = [
    { x: -0.36, z: -0.2, h: 0.5, w: 0.13 },
    { x: -0.16, z: 0.14, h: 0.64, w: 0.15 },
    { x: 0.22, z: -0.06, h: 0.56, w: 0.14 },
    { x: 0.36, z: 0.24, h: 0.44, w: 0.12 },
    { x: 0.04, z: -0.38, h: 0.54, w: 0.14 },
    { x: 0.46, z: -0.26, h: 0.4, w: 0.11 },
    { x: -0.42, z: 0.2, h: 0.48, w: 0.12 },
    { x: -0.06, z: 0.36, h: 0.42, w: 0.12 },
    { x: 0.3, z: 0.04, h: 0.36, w: 0.1 },
    { x: -0.26, z: -0.34, h: 0.46, w: 0.12 },
  ];
  return (
    <group position={pos} scale={1.6}>
      {b.map((it, i) => (
        <Building key={i} {...it} color={grey[i % grey.length]} />
      ))}

      {/* Salesforce Tower — sleek tapered obelisk with a soft glowing crown */}
      <group position={[0.12, 0, -0.04]}>
        <mesh position={[0, 0.7, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.052, 0.094, 1.4, 24]} />
          <meshStandardMaterial color="#6f8499" roughness={0.28} metalness={0.4} />
        </mesh>
        <mesh position={[0, 1.49, 0]} castShadow>
          <cylinderGeometry args={[0.02, 0.052, 0.2, 24]} />
          <meshStandardMaterial color="#d8c596" emissive="#ffcf85" emissiveIntensity={0.5} roughness={0.4} />
        </mesh>
      </group>

      {/* Transamerica Pyramid — white 4-sided pyramid + spire + wings */}
      <group position={[-0.24, 0, 0.18]}>
        <mesh position={[0, 0.55, 0]} rotation={[0, Math.PI / 4, 0]} castShadow receiveShadow>
          <coneGeometry args={[0.13, 1.05, 4]} />
          <meshStandardMaterial color="#eee9de" roughness={0.75} />
        </mesh>
        <mesh position={[0, 1.16, 0]} castShadow>
          <cylinderGeometry args={[0.004, 0.01, 0.24, 4]} />
          <meshStandardMaterial color="#d0cabd" roughness={0.7} />
        </mesh>
        {[-0.07, 0.07].map((dx, i) => (
          <mesh key={i} position={[dx, 0.68, 0]} castShadow>
            <boxGeometry args={[0.02, 0.36, 0.05]} />
            <meshStandardMaterial color="#e6e1d6" roughness={0.8} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** Hoover Tower (Stanford): slender sandstone shaft, arched belfry, red-tile roof. */
function HooverTower({ pos }: { pos: V3 }) {
  const arch = (rot: number) => (
    <group rotation={[0, rot, 0]}>
      {[-0.045, 0, 0.045].map((dx, i) => (
        <mesh key={i} position={[dx, 1.62, 0.101]}>
          <boxGeometry args={[0.025, 0.14, 0.02]} />
          <meshStandardMaterial color="#5b4a32" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
  return (
    <group position={pos} scale={1.7}>
      {/* plinth */}
      <mesh position={[0, 0.06, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.22, 0.12, 0.22]} />
        <meshStandardMaterial color="#cdba8d" roughness={0.85} />
      </mesh>
      {/* slender shaft */}
      <mesh position={[0, 0.85, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.15, 1.5, 0.15]} />
        <meshStandardMaterial color="#ddc99c" roughness={0.85} />
      </mesh>
      {/* belfry */}
      <mesh position={[0, 1.62, 0]} castShadow>
        <boxGeometry args={[0.2, 0.24, 0.2]} />
        <meshStandardMaterial color="#d3bf90" roughness={0.85} />
      </mesh>
      {arch(0)}
      {arch(Math.PI / 2)}
      {arch(Math.PI)}
      {arch(-Math.PI / 2)}
      {/* cornice */}
      <mesh position={[0, 1.76, 0]} castShadow>
        <boxGeometry args={[0.24, 0.04, 0.24]} />
        <meshStandardMaterial color="#e2cfa1" roughness={0.85} />
      </mesh>
      {/* red-tile hipped roof */}
      <mesh position={[0, 1.9, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[0.2, 0.3, 4]} />
        <meshStandardMaterial color="#a4502f" roughness={0.7} />
      </mesh>
      {/* finial */}
      <mesh position={[0, 2.12, 0]} castShadow>
        <cylinderGeometry args={[0.006, 0.012, 0.1, 6]} />
        <meshStandardMaterial color="#7c5a3a" roughness={0.7} />
      </mesh>
    </group>
  );
}

/** Levi's Stadium (Santa Clara): oval bowl, green field, red seating, suite canopy. */
function LevisStadium({ pos }: { pos: V3 }) {
  return (
    <group position={pos} scale={1.9}>
      <group scale={[1.5, 1, 1.1]}>
        <mesh position={[0, 0.13, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.34, 0.27, 0.26, 30, 1, true]} />
          <meshStandardMaterial color="#9a938a" roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.21, 0]} castShadow>
          <cylinderGeometry args={[0.3, 0.33, 0.08, 30, 1, true]} />
          <meshStandardMaterial color="#9e2b25" roughness={0.85} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[0.27, 30]} />
          <meshStandardMaterial color="#3f8f39" roughness={1} />
        </mesh>
        <mesh position={[0, 0.27, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.3, 0.37, 30]} />
          <meshStandardMaterial color="#cfc8bd" roughness={0.8} side={THREE.DoubleSide} />
        </mesh>
      </group>
      <mesh position={[0, 0.31, -0.32]} castShadow>
        <boxGeometry args={[0.64, 0.13, 0.12]} />
        <meshStandardMaterial color="#b8b0a4" roughness={0.8} />
      </mesh>
    </group>
  );
}

function SanJose({ pos }: { pos: V3 }) {
  const b = [
    { x: -0.18, z: 0.0, h: 0.46, w: 0.12 },
    { x: 0.04, z: 0.12, h: 0.66, w: 0.13 },
    { x: 0.22, z: -0.1, h: 0.38, w: 0.12 },
    { x: 0.0, z: -0.22, h: 0.5, w: 0.12 },
    { x: -0.24, z: -0.14, h: 0.36, w: 0.11 },
    { x: 0.18, z: 0.16, h: 0.3, w: 0.1 },
  ];
  const grey = ["#a89c8d", "#94897b", "#b1a596"];
  return (
    <group position={pos} scale={1.5}>
      {b.map((it, i) => (
        <Building key={i} {...it} color={grey[i % grey.length]} />
      ))}
    </group>
  );
}

/** Alcatraz: rocky island + cell house + water tower + lighthouse, in the bay. */
function Alcatraz({ pos }: { pos: V3 }) {
  return (
    <group position={[pos[0], 0, pos[2]]} scale={2.0}>
      <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.2, 0.28, 0.15, 16]} />
        <meshStandardMaterial color="#8c8074" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.19, 0]} castShadow>
        <boxGeometry args={[0.17, 0.11, 0.36]} />
        <meshStandardMaterial color="#cfc8bb" roughness={0.85} />
      </mesh>
      {/* roof */}
      <mesh position={[0, 0.27, 0]} castShadow>
        <boxGeometry args={[0.18, 0.03, 0.37]} />
        <meshStandardMaterial color="#7a6f63" roughness={0.9} />
      </mesh>
      {/* lighthouse */}
      <mesh position={[0.05, 0.34, 0.16]} castShadow>
        <cylinderGeometry args={[0.016, 0.024, 0.2, 10]} />
        <meshStandardMaterial color="#f2eee4" roughness={0.6} />
      </mesh>
      <mesh position={[0.05, 0.46, 0.16]}>
        <sphereGeometry args={[0.024, 10, 8]} />
        <meshStandardMaterial color="#e8633a" emissive="#e8633a" emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}

const REDWOODS: [number, number, number][] = [
  [0, 0, 0.58], [0.17, 0.1, 0.64], [-0.14, 0.08, 0.5], [0.07, -0.16, 0.68],
  [-0.2, -0.05, 0.48], [0.22, -0.12, 0.6], [-0.07, 0.2, 0.62], [0.14, 0.22, 0.52],
  [-0.22, 0.16, 0.66], [0.03, -0.07, 0.72], [0.26, 0.07, 0.5], [-0.12, -0.22, 0.56],
];
/** Muir Woods: a grove of tall, dark redwoods north of the gate. */
function MuirWoods({ pos }: { pos: V3 }) {
  return (
    <group position={pos}>
      {REDWOODS.map(([dx, dz, h], i) => (
        <group key={i} position={[dx, 0, dz]}>
          <mesh position={[0, h * 0.12, 0]} castShadow>
            <cylinderGeometry args={[0.013, 0.018, h * 0.24, 5]} />
            <meshStandardMaterial color="#5a3a26" roughness={0.9} />
          </mesh>
          <mesh position={[0, h * 0.55, 0]} castShadow>
            <coneGeometry args={[0.05, h * 0.9, 6]} />
            <meshStandardMaterial color="#2f5d33" roughness={1} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export default function Landmarks({ data }: { data: TerrainData }) {
  const places = useMemo(() => {
    const ground = (lng: number, lat: number): V3 => {
      const [x, z] = lngLatToScene(data.meta, lng, lat);
      return [x, Math.max(terrainYAtScene(data, x, z), 0), z];
    };
    const water = (lng: number, lat: number): V3 => {
      const [x, z] = lngLatToScene(data.meta, lng, lat);
      return [x, 0, z];
    };
    return {
      gg: water(-122.478, 37.82), // the Golden Gate strait
      sf: ground(-122.401, 37.793), // downtown SF, on the peninsula
      alcatraz: water(-122.423, 37.827), // in the bay
      hoover: ground(-122.166, 37.4275), // Stanford / Palo Alto
      sj: ground(-121.886, 37.338), // San Jose
      levis: ground(-121.9696, 37.403), // Santa Clara
      muir: ground(-122.572, 37.892), // Muir Woods, Marin
    };
  }, [data]);

  return (
    <group>
      <GoldenGate pos={places.gg} />
      <SanFrancisco pos={places.sf} />
      <Alcatraz pos={places.alcatraz} />
      <HooverTower pos={places.hoover} />
      <SanJose pos={places.sj} />
      <LevisStadium pos={places.levis} />
      <MuirWoods pos={places.muir} />
    </group>
  );
}
