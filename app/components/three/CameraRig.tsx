"use client";

import { useEffect, useMemo, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { usePathname } from "next/navigation";
import * as THREE from "three";
import type { Anchor } from "@/lib/terrain";
import { setCameraFlying } from "@/lib/camera-bus";

/**
 * The camera is on rails — no free-look (DESIGN-PHASE2.md §3). Default shot:
 * offshore over the Pacific, elevated, looking north-east so the coastline
 * runs diagonally from upper-left (Stinson) to lower-right (Big Sur) with
 * water lower-left, land upper-right, and sky sharing the frame. Slow ambient
 * drift so the scene breathes. Clicking a buoy (route change) flies a smooth
 * eased path to a low shot — buoy lower-third, coast behind. Retargeting
 * mid-flight is automatic because we always lerp toward the current target.
 */
const HOME_POS = new THREE.Vector3(-11.0, 8.0, 7.0);
const HOME_LOOK = new THREE.Vector3(2.2, 2.0, -1.8);
// Portrait phones get a far narrower HORIZONTAL field of view, so the wide buoy
// spread (Stinson … Big Sur) falls off the sides. Pull the home camera back
// along its view axis so the whole coast fits the tall frame, and widen the FOV.
const HOME_POS_PORTRAIT = HOME_LOOK.clone().add(
  HOME_POS.clone().sub(HOME_LOOK).multiplyScalar(1.85),
);
// Portrait re-aims toward the centre of the buoy spread and pulls back just
// enough — a fully fitted shot felt too wide/zoomed-out. Four buoys sit well
// inside; the far Contact (Big Sur) rides the right edge on the narrowest
// phones, with the bottom index nav as the guaranteed reach.
const HOME_LOOK_PORTRAIT = new THREE.Vector3(1.0, 1.0, 1.0);
const FOV_LANDSCAPE = 50;
const FOV_PORTRAIT = 64;
// Adaptive framing: blend the landscape shot → the portrait shot CONTINUOUSLY by
// aspect ratio, so the in-between "narrow landscape" window sizes (skinnier than
// desktop, not as tall as a phone) zoom out enough to keep all five buoys in frame
// instead of falling off a hard landscape/portrait switch.
const ASPECT_WIDE = 1.6; // at/above this aspect, use the tuned landscape shot unchanged
const ASPECT_NARROW = 0.6; // at/below this aspect, use the full portrait shot

// Dev-only: ?debugcam=px,py,pz,tx,ty,tz pins the camera for the visual
// iteration loop (model close-ups). Never active in production builds.
function debugCam(): { pos: THREE.Vector3; look: THREE.Vector3 } | null {
  if (process.env.NODE_ENV !== "development" || typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("debugcam");
  if (!raw) return null;
  const n = raw.split(",").map(Number);
  if (n.length !== 6 || n.some((v) => !Number.isFinite(v))) return null;
  return { pos: new THREE.Vector3(n[0], n[1], n[2]), look: new THREE.Vector3(n[3], n[4], n[5]) };
}

export default function CameraRig({ anchors }: { anchors: Anchor[] }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const aspect = size.width / Math.max(1, size.height);
  // 0 = wide-desktop framing, 1 = narrow-portrait framing; continuous in between so
  // every aspect gets a fitted shot rather than one of two hard-coded extremes.
  const narrow = Math.min(1, Math.max(0, (ASPECT_WIDE - aspect) / (ASPECT_WIDE - ASPECT_NARROW)));
  const fov = FOV_LANDSCAPE + (FOV_PORTRAIT - FOV_LANDSCAPE) * narrow;
  const homePos = useMemo(() => HOME_POS.clone().lerp(HOME_POS_PORTRAIT, narrow), [narrow]);
  const homeLook = useMemo(() => HOME_LOOK.clone().lerp(HOME_LOOK_PORTRAIT, narrow), [narrow]);
  const pathname = usePathname();
  const slug = pathname.replace(/^\//, "");
  const anchor = anchors.find((a) => a.slug === slug) ?? null;
  const dbg = useMemo(() => debugCam(), []);

  // Widen the FOV as the frame narrows so more of the coast fits.
  /* eslint-disable react-hooks/immutability -- three.js cameras are mutated in place; updateProjectionMatrix() applies the change. */
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = fov;
    cam.updateProjectionMatrix();
  }, [camera, fov]);
  /* eslint-enable react-hooks/immutability */

  const desiredPos = useRef(new THREE.Vector3());
  const desiredLook = useRef(new THREE.Vector3());
  const look = useRef(HOME_LOOK.clone());
  // A route change starts a fly; FpsGovernor freezes escalation while flying so a
  // Tier-B geometry rebuild can't land as a mid-flight stall. Cleared on arrival.
  const flying = useRef(false);
  useEffect(() => {
    flying.current = true;
    setCameraFlying(true);
  }, [slug]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    if (dbg) {
      camera.position.copy(dbg.pos);
      camera.lookAt(dbg.look);
      return;
    }
    if (anchor) {
      // low shot: offshore of the buoy, looking past it toward the coast,
      // buoy settling into the lower third of the frame
      desiredPos.current.set(anchor.x - 1.55, 0.6, anchor.z + 1.3);
      desiredLook.current.set(anchor.x + 0.5, 0.28, anchor.z - 0.45);
    } else {
      desiredPos.current.set(
        homePos.x + Math.sin(t * 0.07) * 0.5,
        homePos.y + Math.cos(t * 0.05) * 0.25,
        homePos.z + Math.sin(t * 0.04) * 0.35,
      );
      desiredLook.current.copy(homeLook);
    }
    // ~1.8s ease feel; smooth, interruptible, and frame-rate independent
    // (0.045/frame at 60fps, normalized to wall time for 120Hz/30Hz displays)
    const k = 1 - Math.pow(1 - 0.045, delta * 60);
    camera.position.lerp(desiredPos.current, k);
    look.current.lerp(desiredLook.current, k);
    camera.lookAt(look.current);

    // The fly is "done" once the camera has essentially reached its target; clear
    // the flying flag so the governor can resume (the camera-bus also self-expires
    // after a watchdog window, so a missed clear can never wedge the governor).
    if (
      flying.current &&
      camera.position.distanceTo(desiredPos.current) < 0.25 &&
      look.current.distanceTo(desiredLook.current) < 0.25
    ) {
      flying.current = false;
      setCameraFlying(false);
    }
  });

  return null;
}
