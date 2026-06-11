"use client";

import { useRef } from "react";
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
const HOME_POS = new THREE.Vector3(-5.6, 7.2, 13.2);
const HOME_LOOK = new THREE.Vector3(1.6, -0.2, -3.2);

export default function CameraRig({ anchors }: { anchors: Anchor[] }) {
  const { camera } = useThree();
  const pathname = usePathname();
  const slug = pathname.replace(/^\//, "");
  const anchor = anchors.find((a) => a.slug === slug) ?? null;

  const desiredPos = useRef(new THREE.Vector3());
  const desiredLook = useRef(new THREE.Vector3());
  const look = useRef(HOME_LOOK.clone());

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (anchor) {
      // low shot: offshore of the buoy, looking past it toward the coast
      desiredPos.current.set(anchor.x - 1.55, 0.6, anchor.z + 1.3);
      desiredLook.current.set(anchor.x + 0.5, 0.1, anchor.z - 0.45);
    } else {
      desiredPos.current.set(
        HOME_POS.x + Math.sin(t * 0.07) * 0.5,
        HOME_POS.y + Math.cos(t * 0.05) * 0.25,
        HOME_POS.z + Math.sin(t * 0.04) * 0.35,
      );
      desiredLook.current.copy(HOME_LOOK);
    }
    // ~1.8s ease feel; smooth and interruptible
    camera.position.lerp(desiredPos.current, 0.045);
    look.current.lerp(desiredLook.current, 0.045);
    camera.lookAt(look.current);
  });

  return null;
}
