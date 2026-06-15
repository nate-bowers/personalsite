"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Conditions } from "@/lib/ndbc";
import type { OpennessField } from "@/lib/openness";
import type { TerrainData } from "@/lib/terrain";
import { oceanParams } from "@/lib/ocean-map";
import { waterSurface, dispFade } from "@/lib/gerstner";

/**
 * A rare humpback BREACH out in the open Pacific seaward of station 46012 —
 * the single most memorable beat on the page (~1-in-20 loads; force ?whale=1).
 *
 * The whale lives submerged. A few seconds after the scene is ready it makes
 * exactly ONE breach: rises out of the sea at ~45°, arcs and rolls, then crashes
 * back with a splash; a soft misty blow puffs up as it settles, and it slips
 * under again. Vertical motion is a hand-shaped time curve whose entry/exit are
 * pinned onto the live Gerstner surface so it meets the real sea exactly.
 *
 * Backlit by the near-behind sun, the slate body would read as a silhouette, so
 * a mild same-color emissive keeps the form alive (same trick as the landmarks).
 */

// dark slate blue-grey humpback; paler barnacled underside; pale-mist blow
const SKIN = "#36404e";
const BELLY = "#7c8896";
const MIST = "#FFD9A0"; // sun-glow tint for the blow

// ----------------------------------------------------------- the whale model
// Built once in local space: forward = +X (snout), up = +Y, body length ~1.0.
// All parts share SKIN so they merge into one draw call; the paler belly is a
// second merged mesh layered just under the body.

// mergeGeometries requires every input to carry the SAME attribute set and all
// be indexed (or all non-indexed). Different primitives (Lathe/Box/Cone/Extrude)
// disagree, so normalize each part to a uniform indexed position+normal form.
function clean(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const flat = g.index ? g.toNonIndexed() : g;
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", flat.getAttribute("position").clone());
  flat.computeVertexNormals();
  out.setAttribute("normal", flat.getAttribute("normal").clone());
  return out;
}

function buildWhale() {
  const skinParts: THREE.BufferGeometry[] = [];
  const bellyParts: THREE.BufferGeometry[] = [];

  // --- body: a lathe profile (radius along the spine) rotated into a rounded,
  //     tapered hull, then stretched along X. Bulbous head, full mid-body,
  //     narrowing to a slender caudal peduncle at the tail.
  // length runs 0..1 along the spine; radius peaks ~0.135 so the hull is a long
  // tapered torpedo (~7x longer than it is wide), not a blob.
  const SEG = 20;
  const prof: THREE.Vector2[] = [];
  for (let i = 0; i <= SEG; i++) {
    const u = i / SEG; // 0 snout .. 1 tail-stock
    // girth curve: rounded nose, full shoulders just behind the head, long
    // taper to a slender caudal peduncle at the tail
    const r =
      Math.sin(Math.PI * Math.pow(u, 0.55)) * (1 - 0.62 * u) * 0.135 + 0.006;
    prof.push(new THREE.Vector2(Math.max(r, 0.005), u)); // (radius, height-along-axis)
  }
  const body = new THREE.LatheGeometry(prof, 18);
  // lathe spins around Y (snout at y=0, tail at y=1). Rotate so the spine lies
  // along X with the SNOUT toward +X, then center on the origin: snout at +0.5,
  // tail at -0.5. Flatten z a touch so the whale is slightly taller than wide.
  body.rotateZ(Math.PI / 2); // snout -> +X after the translate below
  body.translate(0.5, 0, 0);
  body.scale(1.0, 1.0, 0.82);
  skinParts.push(body);

  // pleated throat / paler underside: a thinner lathe shell sitting just below
  const bellyProf = prof.map(
    (p) => new THREE.Vector2(Math.max(p.x * 0.93, 0.01), p.y),
  );
  const bellyShell = new THREE.LatheGeometry(bellyProf, 18, Math.PI / 2, Math.PI);
  bellyShell.rotateZ(Math.PI / 2);
  bellyShell.translate(0.5, 0, 0);
  bellyShell.scale(1.0, 1.0, 0.82);
  bellyShell.translate(0, -0.008, 0); // sit just under the belly line
  bellyParts.push(bellyShell);

  // --- head knobbly tubercles: little bumps along the snout ridge
  for (let i = 0; i < 5; i++) {
    const u = 0.04 + i * 0.05;
    const knob = new THREE.SphereGeometry(0.018 - i * 0.001, 6, 5);
    knob.translate(0.5 - u, 0.04 + Math.sin(u * 6) * 0.004, 0);
    skinParts.push(knob);
  }

  // --- pectoral fins: humpbacks have famously huge wing-like flippers (up to a
  //     third of body length). Each is one long, smooth, swept blade extruded
  //     from a tapered leaf profile in the X(length)/Z(span) plane, then thinned
  //     in Y, splayed out-and-down from the shoulder and mirrored to both sides.
  const makePec = (side: 1 | -1) => {
    const sh = new THREE.Shape();
    const SPAN = 0.46; // flipper length out from the body
    sh.moveTo(0, 0); // leading-edge root
    sh.quadraticCurveTo(SPAN * 0.5, 0.075, SPAN, 0.03); // leading edge sweeps out & tip
    sh.quadraticCurveTo(SPAN * 0.97, -0.01, SPAN * 0.9, -0.02); // rounded tip
    sh.quadraticCurveTo(SPAN * 0.5, -0.06, 0, -0.085); // trailing edge back to root
    sh.lineTo(0, 0);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.022, bevelEnabled: false });
    g.translate(0, 0, -0.011); // center the thin extrusion on z
    // the shape lives in XY; lay it flat so its span runs along Z (out the side)
    g.rotateX(-Math.PI / 2); // XY -> XZ, blade now horizontal
    // a little down-droop along its length and root at the shoulder
    g.rotateX(side * 0.18); // splay tips downward
    g.rotateZ(0.12); // tip swept slightly back
    g.scale(1, 1, side); // mirror to the correct side
    g.translate(0.17, -0.055, side * 0.06); // shoulder attach point
    return g;
  };
  skinParts.push(makePec(1), makePec(-1));

  // --- dorsal hump: the small stepped fin/hump two-thirds back
  const dorsal = new THREE.ConeGeometry(0.05, 0.09, 5);
  dorsal.rotateZ(-Math.PI / 2.4);
  dorsal.scale(1.6, 1, 0.5);
  dorsal.translate(-0.16, 0.17, 0);
  skinParts.push(dorsal);

  // --- fluke (tail): one broad horizontal butterfly with swept tips and the
  //     signature center notch. Drawn in the X(length)/Z(span) plane so it lies
  //     flat like a real whale tail (horizontal, unlike a fish).
  const fl = new THREE.Shape();
  const W = 0.27; // half-span of the tail
  fl.moveTo(0.04, 0); // front-center, where it joins the peduncle
  fl.quadraticCurveTo(-0.02, W * 0.55, -0.05, W); // leading edge out to the tip
  fl.quadraticCurveTo(-0.12, W * 0.92, -0.14, W * 0.78); // swept-back pointed tip
  fl.quadraticCurveTo(-0.1, W * 0.4, -0.05, 0); // trailing edge in to center notch
  fl.quadraticCurveTo(-0.1, -W * 0.4, -0.14, -W * 0.78); // mirror lobe
  fl.quadraticCurveTo(-0.12, -W * 0.92, -0.05, -W);
  fl.quadraticCurveTo(-0.02, -W * 0.55, 0.04, 0);
  const fluke = new THREE.ExtrudeGeometry(fl, { depth: 0.018, bevelEnabled: false });
  fluke.translate(0, 0, -0.009);
  fluke.rotateX(-Math.PI / 2); // XZ in shape -> lay flat (span along world Z)
  fluke.rotateZ(0.12); // tips raised a touch — caught mid-stroke
  fluke.translate(-0.47, 0.0, 0); // at the caudal peduncle (tail end)
  skinParts.push(fluke);

  const skin = mergeGeometries(skinParts.map(clean))!;
  const belly = mergeGeometries(bellyParts.map(clean))!;
  skin.computeVertexNormals();
  belly.computeVertexNormals();
  return { skin, belly };
}

// ------------------------------------------------------------- breach timing
// All times are seconds RELATIVE to the breach start.
const T_RISE = 1.25; // out of the water, climbing
const T_APEX = 1.55; // hangs at the top
const T_FALL = 2.7; // crashes back down
const T_DONE = 3.0; // fully back under
const SPLASH_AT = T_FALL; // splash + blow trigger near re-entry
const SPOUT_LIFE = 2.2; // how long the blow lingers

// vertical offset of the whale's centre ABOVE the water surface as a function
// of breach-relative time. 0 = centre at the sea surface (mostly submerged).
function breachLift(tb: number): number {
  if (tb < 0) return -0.18;
  if (tb < T_RISE) {
    // explosive launch — fast then easing toward apex
    const u = tb / T_RISE;
    return -0.18 + (0.82 + 0.18) * Math.sin((u * Math.PI) / 2) * 1.0;
  }
  if (tb < T_APEX) return 0.82; // hang time at the top
  if (tb < T_FALL) {
    // accelerating fall back to the surface (gravity)
    const u = (tb - T_APEX) / (T_FALL - T_APEX);
    return 0.82 - 1.0 * (u * u);
  }
  if (tb < T_DONE) {
    // sink a little under after the crash, then level off
    const u = (tb - T_FALL) / (T_DONE - T_FALL);
    return -0.18 - 0.12 * Math.sin(u * Math.PI);
  }
  return -0.18;
}

// pitch (nose up/down) follows the arc: steep climb -> level at apex -> nose-down dive
function breachPitch(tb: number): number {
  if (tb < 0) return 0;
  if (tb < T_APEX) {
    const u = Math.min(1, tb / T_APEX);
    return 0.85 * (1 - u); // ~49° up at launch, leveling toward apex
  }
  if (tb < T_DONE) {
    const u = (tb - T_APEX) / (T_DONE - T_APEX);
    return -1.15 * u; // rotates nose-down for the dive-in
  }
  return 0;
}

// the signature breach roll — twists onto its side mid-air
function breachRoll(tb: number): number {
  if (tb < 0 || tb > T_DONE) return 0;
  const u = THREE.MathUtils.clamp(tb / T_FALL, 0, 1);
  return Math.sin(u * Math.PI) * 1.3; // up to ~75° then back
}

export default function Whale({
  conditions,
  openness,
}: {
  conditions: Conditions;
  openness: OpennessField;
  data: TerrainData;
}) {
  const group = useRef<THREE.Group>(null);
  const spout = useRef<THREE.Group>(null);
  const params = useMemo(() => oceanParams(conditions), [conditions]);
  const geo = useMemo(() => buildWhale(), []);

  // decide ONCE per load whether the breach happens; force with ?whale=1.
  // Decided on the first frame (in useFrame, not during render) so the random
  // draw never runs impurely at render time. The whale group is always mounted
  // but parked invisible (scale ~0) until/unless it's active.
  const activeRef = useRef<boolean | null>(null);

  // breach start time (absolute clock seconds), set on the first frame so it is
  // a few seconds after the scene actually streams in
  const startAt = useRef<number | null>(null);

  // the spot: a couple units seaward (more -x) of station 46012, open water
  const SPOT = useMemo(() => ({ x: -6.35, z: -1.55 }), []);

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    if (activeRef.current === null) {
      const forced =
        typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("whale") === "1";
      activeRef.current = forced || Math.random() < 0.05;
    }
    const active = activeRef.current;
    if (!active) return;
    const t = state.clock.elapsedTime;
    // first whale frame fires as the Canvas mounts; hold the leap a beat so the
    // terrain has streamed in and the scene has settled before the rare moment
    if (startAt.current === null) startAt.current = t + 6.0;
    let tb = t - startAt.current; // breach-relative seconds
    // DEV-ONLY tuning freeze: ?whalefreeze=<seconds> pins breach-relative time
    if (typeof window !== "undefined") {
      const fz = new URLSearchParams(window.location.search).get("whalefreeze");
      if (fz !== null && process.env.NODE_ENV === "development") tb = Number(fz);
    }

    const { x: cx, z: cz } = SPOT;
    const cam = state.camera.position;
    const fade = dispFade(Math.hypot(cam.x - cx, cam.z - cz));
    const s = waterSurface(cx, cz, t, params, openness.sample(cx, cz) * fade);

    const lift = breachLift(tb);
    g.position.set(cx, s.height + lift, cz);
    // face roughly toward the coast/camera (snout +X) for a flattering profile
    g.rotation.set(0, -0.45, 0);
    // apply arc pitch + signature roll on top of the heading
    g.rotation.x = breachPitch(tb);
    g.rotation.z = breachRoll(tb);

    // before the breach (and well after) keep it tucked just under the surface
    const submerged = tb < -0.05 || tb > T_DONE + 0.4;
    g.visible = true;
    g.scale.setScalar(submerged ? 0.0001 : 1); // hide cleanly when sleeping

    // ---- the blow / spout: a misty plume that punches up where the whale
    //   crashed back, then drifts and dissolves into the golden air.
    const sp = spout.current;
    if (sp) {
      const ts = tb - SPLASH_AT;
      if (active && ts >= 0 && ts < SPOUT_LIFE) {
        sp.visible = true;
        const u = ts / SPOUT_LIFE; // 0..1
        // anchor at the surface where the whale re-entered
        sp.position.set(cx + 0.05, s.height, cz);
        // plume rises fast then eases; whole thing fades in quickly, out slowly
        const rise = 1 - Math.pow(1 - u, 2.2);
        const fadeIn = Math.min(1, u * 7); // snap on at the splash
        const fadeOut = Math.pow(1 - u, 1.4); // long misty dissipation
        const alpha = fadeIn * fadeOut;
        sp.children.forEach((c, i) => {
          const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
          // puffs stacked into a column: lower puffs are denser, higher thinner
          const lvl = i / (sp.children.length - 1); // 0 base .. 1 top
          m.opacity = alpha * (0.85 - lvl * 0.45);
          // climb the column; higher puffs lag so the plume unfurls upward
          const climb = rise * (0.05 + lvl * 0.6);
          c.position.y = 0.04 + climb;
          // gentle spreading drift as it ages, wider near the top
          const spread = (0.04 + lvl * 0.12) * (0.4 + u);
          c.position.x = Math.sin(i * 2.1) * spread;
          c.position.z = Math.cos(i * 1.7) * spread;
          // each puff swells as it rises and thins
          c.scale.setScalar(0.7 + lvl * 0.8 + u * 0.9);
        });
      } else {
        sp.visible = false;
      }
    }
  });

  return (
    <group>
      <group ref={group} scale={0.0001}>
        <mesh geometry={geo.skin}>
          <meshStandardMaterial
            color={SKIN}
            roughness={0.55}
            metalness={0.05}
            emissive={SKIN}
            emissiveIntensity={0.32}
          />
        </mesh>
        <mesh geometry={geo.belly}>
          <meshStandardMaterial
            color={BELLY}
            roughness={0.7}
            emissive={BELLY}
            emissiveIntensity={0.3}
          />
        </mesh>
      </group>

      {/* the misty blow — soft sun-glow puffs stacked into a vertical plume;
          driven (position/scale/opacity) per-frame in useFrame above. The base
          puffs are a touch larger and brighter; the column unfurls upward. */}
      <group ref={spout} visible={false}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <mesh key={i} position={[0, 0.04 + i * 0.05, 0]}>
            <sphereGeometry args={[0.085 + (i % 3) * 0.012, 8, 7]} />
            <meshStandardMaterial
              color={MIST}
              emissive={MIST}
              emissiveIntensity={0.65}
              transparent
              opacity={0}
              depthWrite={false}
              roughness={1}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}
