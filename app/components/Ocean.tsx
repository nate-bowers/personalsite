"use client";

import { useEffect, useRef } from "react";
import type { Conditions } from "@/lib/ndbc";
import { oceanParams } from "@/lib/ocean-map";

/**
 * The v1 2D ocean — now the Phase 2 FALLBACK renderer (reduced-motion / no-WebGL /
 * mobile). Layered sine-wave bands on one <canvas>, driven by live conditions via the
 * shared oceanParams() mapping, painted from the golden-hour water tokens. See
 * DESIGN-PHASE2.md §3 (fallback) and the <Stage> renderer selection.
 */

interface WaveComponent {
  amp: number; // px, before global amplitude scaling
  len: number; // wavelength in px
  phase: number;
}
interface Layer {
  baseFrac: number;
  alpha: number;
  tone: "far" | "near";
  speedMul: number;
  front?: boolean;
  comps: WaveComponent[];
}

const LAYERS: Layer[] = [
  { baseFrac: 0.10, alpha: 0.30, tone: "far", speedMul: 0.5, comps: [
    { amp: 10, len: 520, phase: 0.0 }, { amp: 5, len: 230, phase: 1.1 } ] },
  { baseFrac: 0.26, alpha: 0.38, tone: "far", speedMul: 0.8, comps: [
    { amp: 13, len: 430, phase: 2.0 }, { amp: 6, len: 190, phase: 0.4 } ] },
  { baseFrac: 0.46, alpha: 0.55, tone: "near", speedMul: 1.1, comps: [
    { amp: 16, len: 360, phase: 3.1 }, { amp: 8, len: 160, phase: 1.7 } ] },
  { baseFrac: 0.66, alpha: 0.9, tone: "near", speedMul: 1.5, front: true, comps: [
    { amp: 20, len: 300, phase: 0.7 }, { amp: 10, len: 140, phase: 2.6 }, { amp: 5, len: 80, phase: 1.0 } ] },
];

export default function Ocean({ conditions }: { conditions: Conditions }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { ampScale, speed, windChop } = oceanParams(conditions);

    let width = 0;
    let height = 0;
    const colors = { near: "#1e3a52", far: "#2e2a4f" };

    const readColors = () => {
      const cs = getComputedStyle(document.body);
      const near = cs.getPropertyValue("--water-near").trim();
      const far = cs.getPropertyValue("--water-far").trim();
      if (near) colors.near = near;
      if (far) colors.far = far;
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (tSec: number) => {
      ctx.clearRect(0, 0, width, height);
      const step = Math.max(6, Math.floor(width / 180));
      for (const L of LAYERS) {
        const baseY = height * L.baseFrac;
        ctx.beginPath();
        ctx.moveTo(0, height);
        for (let x = 0; x <= width; x += step) {
          let y = baseY;
          for (const c of L.comps) {
            y += c.amp * ampScale * Math.sin((2 * Math.PI / c.len) * x + c.phase + tSec * speed * L.speedMul);
          }
          if (L.front && windChop > 0) {
            y += windChop * 4 * Math.sin(x * 0.25 + tSec * 6);
          }
          ctx.lineTo(x, y);
        }
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.globalAlpha = L.alpha;
        ctx.fillStyle = L.tone === "near" ? colors.near : colors.far;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    resize();
    readColors();

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;
    let start = performance.now();
    let pausedElapsed = 0;
    let lastColorRead = 0;

    const frame = (now: number) => {
      if (now - lastColorRead > 200) {
        readColors();
        lastColorRead = now;
      }
      draw((now - start) / 1000);
      raf = requestAnimationFrame(frame);
    };

    if (reduce) {
      draw(0);
    } else if (!document.hidden) {
      raf = requestAnimationFrame(frame);
    } else {
      draw(0);
    }

    const onVisibility = () => {
      if (reduce) return;
      if (document.hidden) {
        if (raf) {
          pausedElapsed = performance.now() - start;
          cancelAnimationFrame(raf);
          raf = 0;
        }
      } else if (!raf) {
        start = performance.now() - pausedElapsed;
        raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const ro = new ResizeObserver(() => {
      resize();
      if (reduce) draw(0);
    });
    ro.observe(canvas);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      ro.disconnect();
    };
  }, [conditions]);

  return (
    <canvas
      ref={canvasRef}
      className="ocean-canvas fixed bottom-0 left-0 z-0 h-[55%] w-full"
      aria-hidden
    />
  );
}
