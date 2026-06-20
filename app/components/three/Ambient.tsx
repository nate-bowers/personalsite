"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Conditions } from "@/lib/ndbc";
import type { OpennessField } from "@/lib/openness";
import { oceanParams } from "@/lib/ocean-map";
import { waterSurface, dispFade } from "@/lib/gerstner";

/**
 * Quiet ambient life: a single jet crossing the sky with a fading contrail,
 * and a single shark fin cruising the open Pacific. Both deliberately small,
 * slow and unintrusive — garnish, not subject.
 */

// ---------------------------------------------------------------- the plane
const PLANE_Y = 8.55;
const PLANE_SPEED = 0.55; // units/s — reads as a distant cruising jet
const PLANE_SPAN = 95; // crossing length before it loops
const TRAIL_LEN = 7;

function Jet() {
  const group = useRef<THREE.Group>(null);

  // fading contrail: RGBA vertex colors on a tapered ribbon
  const trailGeo = useMemo(() => {
    const N = 24;
    const verts = new Float32Array((N + 1) * 2 * 3);
    const cols = new Float32Array((N + 1) * 2 * 4);
    const idx: number[] = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const x = -0.3 - t * TRAIL_LEN; // behind the nose
      const w = 0.02 + t * 0.11; // widens as it disperses
      const a = (1 - t) * 0.85; // fades out
      for (let s = 0; s < 2; s++) {
        const vi = (i * 2 + s) * 3;
        verts[vi] = x;
        verts[vi + 1] = 0;
        verts[vi + 2] = s === 0 ? -w : w;
        const ci = (i * 2 + s) * 4;
        cols[ci] = 1;
        cols[ci + 1] = 0.97;
        cols[ci + 2] = 0.94;
        cols[ci + 3] = a;
      }
      if (i < N) {
        const k = i * 2;
        idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(verts, 3));
    g.setAttribute("color", new THREE.BufferAttribute(cols, 4));
    g.setIndex(idx);
    return g;
  }, []);

  // tiny jet: fuselage + wings + tail surfaces, positioned/animated as one group
  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    // phased so a crossing is underway on first load; wraps far off-frame
    const d = (t * PLANE_SPEED + 35) % PLANE_SPAN;
    g.position.set(-50 + d, PLANE_Y, -15 + d * 0.1);
    g.rotation.y = -Math.atan2(0.1, 1);
  });

  return (
    <group ref={group} scale={2.2}>
      {/* fuselage — capsule laid along the flight axis (+X = nose) */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[0.024, 0.17, 3, 6]} />
        <meshStandardMaterial color="#efeae0" roughness={0.5} emissive="#efeae0" emissiveIntensity={0.5} />
      </mesh>
      {/* main wings — a wide, thicker plank so the plane clearly reads as winged
          against the bright sky (the old wing was too thin/short to see) */}
      <mesh position={[0.01, 0, 0]}>
        <boxGeometry args={[0.13, 0.02, 0.46]} />
        <meshStandardMaterial color="#e6e0d4" roughness={0.6} emissive="#e6e0d4" emissiveIntensity={0.5} />
      </mesh>
      {/* horizontal tailplane at the tail */}
      <mesh position={[-0.085, 0, 0]}>
        <boxGeometry args={[0.06, 0.016, 0.2]} />
        <meshStandardMaterial color="#e6e0d4" roughness={0.6} emissive="#e6e0d4" emissiveIntensity={0.5} />
      </mesh>
      {/* vertical stabilizer (tail fin) — sells the airplane silhouette */}
      <mesh position={[-0.088, 0.045, 0]}>
        <boxGeometry args={[0.06, 0.08, 0.014]} />
        <meshStandardMaterial color="#e6e0d4" roughness={0.6} emissive="#e6e0d4" emissiveIntensity={0.5} />
      </mesh>
      <mesh geometry={trailGeo}>
        <meshBasicMaterial vertexColors transparent depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ------------------------------------------------------------ the shark fin

// secret tally of how many times a curious visitor has poked the fin under
const recordDive = () => {
  try {
    const n = Number(localStorage.getItem("coast.shark.dives") ?? "0");
    localStorage.setItem("coast.shark.dives", String((Number.isFinite(n) ? n : 0) + 1));
  } catch {
    /* private mode / no storage — the secret simply isn't kept */
  }
};

// the cruise centre + phase, jumped on each dive so the fin resurfaces elsewhere
interface Cruise {
  ox: number; // x offset added to the lissajous centre
  oz: number; // z offset
  ph: number; // phase offset folded into both axes
}
const CRUISE0: Cruise = { ox: 0, oz: 0, ph: 0 };

// the fin's cruise position for a given time + cruise offsets. Returned vx/vz
// are the planar velocity so the fin can face its heading.
function cruiseAt(t: number, c: Cruise) {
  const a = t * 0.021 + c.ph;
  const b = t * 0.034 + 1.2 + c.ph;
  const cx = -3.3 + c.ox + Math.sin(a) * 1.0;
  const cz = 1.0 + c.oz + Math.sin(b) * 2.0;
  const vx = Math.cos(a) * 1.0 * 0.021;
  const vz = Math.cos(b) * 2.0 * 0.034;
  return { cx, cz, vx, vz };
}

// keep the resurface spot near the home framing: x in [-4.3,-2.3], z in [-1,3]
const nextCruise = (): Cruise => ({
  ox: (Math.random() - 0.5) * 1.6,
  oz: (Math.random() - 0.5) * 2.4,
  ph: Math.random() * Math.PI * 2,
});

// dive timeline (seconds). tip-forward + sink, ~1s under, then rise back.
const T_SINK = 0.55; // fin tips forward and slides under
const T_UNDER = 1.0; // hidden beneath the surface
const T_RISE = 0.7; // breaks the surface again
const T_TOTAL = T_SINK + T_UNDER + T_RISE;
const SPLASH_LIFE = 0.6; // foam ring/droplet lifetime
const SPLASH_N = 7; // pale droplets thrown up

const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
const easeIn = (x: number) => x * x;

function SharkFin({
  conditions,
  openness,
  autoDiveAt = Infinity, // dev-only: screenshot builds can force a dive
}: {
  conditions: Conditions;
  openness: OpennessField;
  autoDiveAt?: number;
}) {
  const group = useRef<THREE.Group>(null);
  const fin = useRef<THREE.Group>(null);
  const splash = useRef<THREE.Group>(null);
  const params = oceanParams(conditions);

  // mutable dive/cruise state, driven entirely inside useFrame
  const dive = useRef<{ t0: number; cruise: Cruise }>({ t0: -Infinity, cruise: CRUISE0 });
  const cruise = useRef<Cruise>(CRUISE0);
  const nextCruiseRef = useRef<Cruise>(CRUISE0);
  const splashAt = useRef<{ t0: number; x: number; z: number; y: number } | null>(null);
  const autoFired = useRef(false);
  const now = useRef(0); // latest clock.elapsedTime, so the click handler shares the clock

  // swept fin blade
  const finGeo = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0.14, 0);
    shape.quadraticCurveTo(0.115, 0.082, 0.04, 0.14); // swept trailing edge
    shape.quadraticCurveTo(0.008, 0.082, 0, 0);
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false });
    g.translate(-0.065, 0, -0.01);
    return g;
  }, []);

  // a thin flat foam rim + a few droplets, reused every splash (cheap, ~7 meshes)
  const ringGeo = useMemo(() => new THREE.RingGeometry(0.82, 1, 28), []);
  const dropGeo = useMemo(() => new THREE.SphereGeometry(1, 6, 5), []);
  const dropOffsets = useMemo(() => {
    // deterministic per-droplet jitter (pure: no Math.random during render) so
    // the splash never reads as a perfect mechanical circle
    const hash = (n: number) => {
      const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
      return x - Math.floor(x);
    };
    return Array.from({ length: SPLASH_N }, (_, i) => {
      const a = (i / SPLASH_N) * Math.PI * 2 + (hash(i * 3 + 1) - 0.5) * 0.5;
      return {
        ca: Math.cos(a),
        sa: Math.sin(a),
        spread: 0.85 + hash(i * 3 + 2) * 0.4, // outward distance multiplier
        rise: 0.07 + hash(i * 3 + 3) * 0.06, // peak arc height (world units)
        size: 0.009 + hash(i * 3 + 4) * 0.006, // droplet radius (world units)
      };
    });
  }, []);

  const startDive = (t: number) => {
    if (t - dive.current.t0 < T_TOTAL) return; // already mid-dive — ignore
    // dev capture: resurface in the SAME spot so a burst can frame the splash
    nextCruiseRef.current = Number.isFinite(autoDiveAt) ? cruise.current : nextCruise();
    dive.current = { t0: t, cruise: cruise.current };
    recordDive();
  };

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    now.current = t; // share the live clock with the click handler

    // dev auto-dive so a screenshot build can capture the splash. While the
    // param is present it RE-ARMS after each dive so a burst reliably catches
    // the 0.6s splash. (autoDiveAt is Infinity in normal use — no effect.)
    if (Number.isFinite(autoDiveAt) && t >= autoDiveAt && t - dive.current.t0 >= T_TOTAL + 1.2) {
      autoFired.current = true;
      startDive(t);
    }

    // ---- dive timeline ----
    const dt = t - dive.current.t0;
    const diving = dt >= 0 && dt < T_TOTAL;

    // pick which cruise drives the planar position. During the underwater
    // window we swap to the new cruise so the fin emerges somewhere fresh.
    let active = cruise.current;
    let sinkOffset = 0; // how far the blade is pushed under (world Y)
    let tipForward = 0; // forward pitch of the blade as it goes down/up

    if (diving) {
      if (dt < T_SINK) {
        const p = dt / T_SINK;
        sinkOffset = easeIn(p) * 0.42;
        tipForward = easeIn(p) * 0.9;
        active = dive.current.cruise;
      } else if (dt < T_SINK + T_UNDER) {
        sinkOffset = 0.42; // fully under, hidden by the water mesh
        tipForward = 0.9;
        active = dt < T_SINK + T_UNDER * 0.5 ? dive.current.cruise : nextCruiseRef.current;
      } else {
        const p = (dt - T_SINK - T_UNDER) / T_RISE;
        sinkOffset = (1 - easeOut(p)) * 0.42;
        tipForward = (1 - easeOut(p)) * 0.9 * 0.6; // gentler tip on the way up
        active = nextCruiseRef.current;
      }
    } else if (dt >= T_TOTAL && dive.current.t0 > -Infinity) {
      // dive finished — commit the new cruise as the steady one
      cruise.current = nextCruiseRef.current;
      dive.current = { t0: -Infinity, cruise: cruise.current };
      active = cruise.current;
    }

    // emit the splash the instant the fin submerges (start of the under window)
    if (diving && dt >= T_SINK && splashAt.current === null) {
      const { cx, cz } = cruiseAt(t, dive.current.cruise);
      const fade0 = dispFade(Math.hypot(state.camera.position.x - cx, state.camera.position.z - cz));
      const s0 = waterSurface(cx, cz, t, params, openness.sample(cx, cz) * fade0);
      splashAt.current = { t0: t, x: cx, z: cz, y: s0.height };
    }
    // a smaller re-entry ripple when it breaks the surface coming back up
    if (diving && dt >= T_SINK + T_UNDER && splashAt.current !== null && t - splashAt.current.t0 > SPLASH_LIFE) {
      const { cx, cz } = cruiseAt(t, nextCruiseRef.current);
      const fade0 = dispFade(Math.hypot(state.camera.position.x - cx, state.camera.position.z - cz));
      const s0 = waterSurface(cx, cz, t, params, openness.sample(cx, cz) * fade0);
      splashAt.current = { t0: t, x: cx, z: cz, y: s0.height };
    }

    // ---- planar position on the live surface ----
    const { cx, cz, vx, vz } = cruiseAt(t, active);
    const cam = state.camera.position;
    const fade = dispFade(Math.hypot(cam.x - cx, cam.z - cz));
    const s = waterSurface(cx, cz, t, params, openness.sample(cx, cz) * fade);
    g.position.set(cx, s.height - 0.012, cz);
    g.rotation.y = Math.atan2(-vz, vx) - Math.PI / 2 + Math.PI / 2;
    g.rotation.z = Math.sin(t * 0.9) * 0.06; // lazy sway

    // the blade itself sinks + tips inside the group (target stays clickable up top)
    const f = fin.current;
    if (f) {
      f.position.y = -sinkOffset;
      f.rotation.x = tipForward; // tip forward as it knifes under
    }

    // ---- splash animation ----
    const sp = splash.current;
    const data = splashAt.current;
    if (sp) {
      if (data) {
        const age = t - data.t0;
        const k = age / SPLASH_LIFE;
        if (k >= 1) {
          sp.visible = false;
          splashAt.current = null;
        } else {
          sp.visible = true;
          // anchor the splash to the live surface at the submerge spot
          const fadeS = dispFade(Math.hypot(cam.x - data.x, cam.z - data.z));
          const sS = waterSurface(data.x, data.z, t, params, openness.sample(data.x, data.z) * fadeS);
          sp.position.set(data.x, sS.height + 0.004, data.z);

          const grow = 0.05 + easeOut(k) * 0.17; // foam-rim radius (world units)
          const alpha = (1 - k) * (1 - k); // quadratic fade-out
          // expanding flat foam rim (lies flat on the water surface)
          const ring = sp.children[0] as THREE.Mesh;
          ring.scale.set(grow, grow, grow);
          (ring.material as THREE.MeshBasicMaterial).opacity = alpha * 0.55;
          // a handful of pale droplets thrown up: out + ballistic arc + settle.
          // droplets only fly during the first ~half of the splash, then vanish.
          const dropAlpha = Math.max(0, 1 - k * 1.7);
          const arc = Math.sin(Math.min(1, k * 1.4) * Math.PI); // 0 -> 1 -> 0
          for (let i = 0; i < SPLASH_N; i++) {
            const d = sp.children[i + 1] as THREE.Mesh;
            const o = dropOffsets[i];
            const r = grow * o.spread;
            d.position.set(o.ca * r, arc * o.rise, o.sa * r);
            const ds = o.size * (0.6 + dropAlpha * 0.6); // shrink as they fade
            d.scale.set(ds, ds, ds);
            (d.material as THREE.MeshBasicMaterial).opacity = dropAlpha;
          }
        }
      } else {
        sp.visible = false;
      }
    }
  });

  return (
    <>
      {/* the cruising fin — this group MOVES to the fin position every frame */}
      <group ref={group}>
        {/* the blade — sinks/tips on dive within the group */}
        <group ref={fin}>
          <mesh geometry={finGeo} rotation={[0, Math.PI / 2, 0]}>
            <meshStandardMaterial color="#39414c" roughness={0.55} emissive="#39414c" emissiveIntensity={0.3} />
          </mesh>
        </group>

        {/* generous invisible raycast target so the fin is easy to click/tap */}
        <mesh
          position={[0, 0.06, 0]}
          onClick={(e) => {
            e.stopPropagation();
            startDive(now.current); // same clock the useFrame timeline runs on
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => (document.body.style.cursor = "")}
        >
          <sphereGeometry args={[0.28, 10, 8]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      </group>

      {/* splash lives in WORLD space (a sibling, not under the moving fin) so its
          absolute position is set directly; one foam ring + a few pale droplets */}
      <group ref={splash} visible={false}>
        <mesh geometry={ringGeo} rotation={[-Math.PI / 2, 0, 0]}>
          <meshBasicMaterial
            color="#FFD9A0"
            transparent
            opacity={0}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        {Array.from({ length: SPLASH_N }, (_, i) => (
          <mesh key={i} geometry={dropGeo}>
            <meshBasicMaterial color="#FBF3E4" transparent opacity={0} depthWrite={false} />
          </mesh>
        ))}
      </group>
    </>
  );
}

export default function Ambient({
  conditions,
  openness,
}: {
  conditions: Conditions;
  openness: OpennessField;
}) {
  // dev-only: ?sharkdive=N auto-triggers a dive N seconds after load so a
  // screenshot build can catch the splash. Absent in normal use.
  const autoDiveAt = useMemo(() => {
    if (typeof window === "undefined") return Infinity;
    const raw = new URLSearchParams(window.location.search).get("sharkdive");
    const n = raw === null ? Infinity : Number(raw);
    return Number.isFinite(n) ? n : Infinity;
  }, []);

  return (
    <group>
      <Jet />
      <SharkFin conditions={conditions} openness={openness} autoDiveAt={autoDiveAt} />
    </group>
  );
}
