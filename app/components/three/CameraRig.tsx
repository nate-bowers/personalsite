"use client";

import { useMemo, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { usePathname } from "next/navigation";
import * as THREE from "three";
import type { Anchor } from "@/lib/terrain";

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
  const { camera } = useThree();
  const pathname = usePathname();
  const slug = pathname.replace(/^\//, "");
  const anchor = anchors.find((a) => a.slug === slug) ?? null;
  const dbg = useMemo(() => debugCam(), []);

  const desiredPos = useRef(new THREE.Vector3());
  const desiredLook = useRef(new THREE.Vector3());
  const look = useRef(HOME_LOOK.clone());

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
        HOME_POS.x + Math.sin(t * 0.07) * 0.5,
        HOME_POS.y + Math.cos(t * 0.05) * 0.25,
        HOME_POS.z + Math.sin(t * 0.04) * 0.35,
      );
      desiredLook.current.copy(HOME_LOOK);
    }
    // ~1.8s ease feel; smooth, interruptible, and frame-rate independent
    // (0.045/frame at 60fps, normalized to wall time for 120Hz/30Hz displays)
    const k = 1 - Math.pow(1 - 0.045, delta * 60);
    camera.position.lerp(desiredPos.current, k);
    look.current.lerp(desiredLook.current, k);
    camera.lookAt(look.current);
  });

  return null;
}
