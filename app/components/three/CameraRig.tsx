"use client";

import { useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { usePathname } from "next/navigation";
import * as THREE from "three";
import type { Anchor } from "@/lib/terrain";

/**
 * The camera is on rails — no free-look (DESIGN-PHASE2.md §3). Default: offshore,
 * elevated, coast diagonal, slow ambient drift. When a section route is active it
 * flies a smooth eased curve to a low shot of that buoy with the coast behind; back
 * to "/" returns home. Retargeting mid-flight (another buoy, or back) is automatic
 * because we always lerp toward the *current* target.
 */
// 3/4 aerial over the Bay Area: offshore to the south-west (Pacific), elevated,
// looking north-east across the bay and the East Bay hills.
const HOME_POS = new THREE.Vector3(-10, 8.5, 9.5);
const HOME_LOOK = new THREE.Vector3(0.5, -0.6, -1.5);

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
      // low shot: just offshore of the buoy and slightly up, coast (east/+x) behind it
      desiredPos.current.set(anchor.x - 2.6, 1.5, anchor.z + 2.4);
      desiredLook.current.set(anchor.x + 0.8, 0.15, anchor.z - 0.6);
    } else {
      desiredPos.current.set(
        HOME_POS.x + Math.sin(t * 0.07) * 0.45,
        HOME_POS.y + Math.cos(t * 0.05) * 0.22,
        HOME_POS.z + Math.sin(t * 0.04) * 0.3,
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
