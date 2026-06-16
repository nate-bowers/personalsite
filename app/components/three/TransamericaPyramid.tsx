"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

type V3 = [number, number, number];

function box(w: number, h: number, d: number, x: number, y: number, z: number) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

function merge(parts: THREE.BufferGeometry[]) {
  return mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)))!;
}

/**
 * The Transamerica Pyramid, San Francisco financial district.
 *
 * A tall, slender four-sided pyramid: square base tapering to a point, the two
 * signature windowless vertical "wings" / setbacks running up the EAST and WEST
 * faces near the top (the service shafts — elevators/stairs to -X, the smoke
 * tower to +X), the pale crushed-quartz precast skin with thin white aluminum
 * vertical mullions, the windowless upper flanks, and the tall aluminum crown
 * spire at the apex.
 *
 * Geometry is merged by material (quartz skin / window reveals / spire), with a
 * little emissive so the shaded faces still read at golden hour. ~6 draw worth
 * of geometry collapsed into 3 meshes.
 *
 * Built around a +Y axis. The full pyramid (pre-spire) rises from y=0 to a near
 * point at PEAK; the spire continues above. Plan is square in X/Z, the wings run
 * along ±X (east/west).
 */

const BASE = 0.21; // half-width of the square base at ground
const PEAK = 1.94; // where the four-sided pyramid converges (before the spire)

// half-width of the pyramid plan at height y (linear taper to a small flat top)
function halfAt(y: number) {
  const t = Math.min(Math.max(y / PEAK, 0), 1);
  return THREE.MathUtils.lerp(BASE, 0.012, t);
}

export default function TransamericaPyramid({ pos }: { pos: V3 }) {
  const { quartz, reveal, spire } = useMemo(() => {
    const quartzParts: THREE.BufferGeometry[] = [];
    const revealParts: THREE.BufferGeometry[] = [];
    const spireParts: THREE.BufferGeometry[] = [];

    /* ---------- crushed-quartz precast skin: the tapering shaft ----------
     * Stack of thin square slabs whose plan shrinks with height — a faceted
     * four-sided pyramid that keeps crisp corners (vs. a Cone) and lets the
     * mullions/reveals sit on flat faces. */
    const RINGS = 26;
    for (let i = 0; i < RINGS; i++) {
      const y0 = (i / RINGS) * PEAK;
      const y1 = ((i + 1) / RINGS) * PEAK;
      const h = y1 - y0;
      const w = halfAt((y0 + y1) / 2) * 2;
      quartzParts.push(box(w, h * 1.02, w, 0, (y0 + y1) / 2, 0));
    }
    // ground-floor entrance plinth, a touch wider than the shaft base
    quartzParts.push(box(BASE * 2 + 0.05, 0.05, BASE * 2 + 0.05, 0, 0.025, 0));

    /* ---------- the two signature vertical wings (east/west service shafts)
     * Blank precast flanks that project from the ±X faces and run from mid-shaft
     * up to near the crown, capped windowless. These read as the building's most
     * recognizable feature. */
    for (const s of [1, -1]) {
      const yBot = 0.92;
      const yTop = 1.82;
      const segs = 16;
      for (let i = 0; i < segs; i++) {
        const y0 = THREE.MathUtils.lerp(yBot, yTop, i / segs);
        const y1 = THREE.MathUtils.lerp(yBot, yTop, (i + 1) / segs);
        const half = halfAt((y0 + y1) / 2);
        const ww = half * 0.62; // wing height in Z (the face it spans)
        const proj = 0.03; // how far it projects out from the face in X
        const cx = s * (half + proj / 2);
        quartzParts.push(box(proj, (y1 - y0) * 1.04, ww, cx, (y0 + y1) / 2, 0));
      }
      // blank flank wall flush on the OUTER tip of the wing (the windowless face)
      // handled by the projection above; add a thin cap rib at the wing crown
      const halfTop = halfAt(yTop);
      quartzParts.push(box(0.04, 0.05, halfTop * 0.64, s * (halfTop + 0.02), yTop, 0));
    }

    /* ---------- window reveals: thin vertical mullion lines on all four faces.
     * Dark slots between the pale precast quartz piers — the tall vertical ribs
     * that give the tower its fluted facade. Stop below the windowless crown. */
    const FACE_TOP = 1.66;
    const cols = [-0.66, -0.4, -0.14, 0.14, 0.4, 0.66]; // fractional across each face
    const vsegs = 20;
    for (let i = 0; i < vsegs; i++) {
      const y0 = (i / vsegs) * FACE_TOP;
      const y1 = ((i + 1) / vsegs) * FACE_TOP;
      const ym = (y0 + y1) / 2;
      const half = halfAt(ym);
      const h = (y1 - y0) * 1.02;
      for (const f of cols) {
        const off = f * half; // position across the face
        // +Z and -Z faces (slot opens toward ±Z)
        revealParts.push(box(half * 0.16, h, 0.012, off, ym, half + 0.004));
        revealParts.push(box(half * 0.16, h, 0.012, off, ym, -(half + 0.004)));
        // +X and -X faces
        revealParts.push(box(0.012, h, half * 0.16, half + 0.004, ym, off));
        revealParts.push(box(0.012, h, half * 0.16, -(half + 0.004), ym, off));
      }
    }
    // narrow vertical reveal slots down the centerline of each wing flank (±X)
    for (const s of [1, -1]) {
      const wsegs = 12;
      for (let i = 0; i < wsegs; i++) {
        const y0 = THREE.MathUtils.lerp(0.96, 1.78, i / wsegs);
        const y1 = THREE.MathUtils.lerp(0.96, 1.78, (i + 1) / wsegs);
        const ym = (y0 + y1) / 2;
        const half = halfAt(ym);
        const proj = 0.03;
        const cx = s * (half + proj + 0.002);
        revealParts.push(box(0.006, (y1 - y0) * 1.02, half * 0.34, cx, ym, 0));
      }
    }

    /* ---------- aluminum crown spire ----------
     * Tall windowless flèche of aluminum panels from the truncated pyramid top
     * to the point. A slim tapered four-sided needle. */
    {
      const SP0 = 1.9; // base of the spire (on the small flat top)
      const SP1 = 2.52; // tip
      const ssegs = 10;
      for (let i = 0; i < ssegs; i++) {
        const y0 = THREE.MathUtils.lerp(SP0, SP1, i / ssegs);
        const y1 = THREE.MathUtils.lerp(SP0, SP1, (i + 1) / ssegs);
        const tw = THREE.MathUtils.lerp(0.032, 0.002, (i + 0.5) / ssegs);
        spireParts.push(box(tw, (y1 - y0) * 1.05, tw, 0, (y0 + y1) / 2, 0));
      }
      // four thin aluminum decorative fins flanking the lower spire (the "ribs"
      // of the windowless cap that the real crown carries)
      for (const s of [1, -1]) {
        spireParts.push(box(0.006, 0.34, 0.05, s * 0.03, 1.78, 0));
        spireParts.push(box(0.05, 0.34, 0.006, 0, 1.78, s * 0.03));
      }
    }

    return {
      quartz: merge(quartzParts),
      reveal: merge(revealParts),
      spire: merge(spireParts),
    };
  }, []);

  return (
    <group position={pos} scale={1.3}>
      <mesh geometry={quartz}>
        {/* pale crushed-quartz precast — a warm off-white that sits in the
            golden-hour palette; emissive so the shaded SE/NE faces still read */}
        <meshStandardMaterial
          color="#efe9da"
          roughness={0.78}
          emissive="#efe9da"
          emissiveIntensity={0.46}
        />
      </mesh>
      <mesh geometry={reveal}>
        {/* recessed window mullion slots — a warm taupe, only a touch darker than
            the quartz so the tower reads as the iconic PALE pyramid, the mullions
            just defining its fluted faces (not a near-black mass) */}
        <meshStandardMaterial
          color="#a89c8d"
          roughness={0.85}
          emissive="#a89c8d"
          emissiveIntensity={0.3}
        />
      </mesh>
      <mesh geometry={spire}>
        {/* brushed aluminum crown — slightly metallic, warm self-lit so the tip
            catches the low west sun like the real flèche */}
        <meshStandardMaterial
          color="#d7d2c4"
          roughness={0.45}
          metalness={0.35}
          emissive="#d7d2c4"
          emissiveIntensity={0.4}
        />
      </mesh>
    </group>
  );
}
