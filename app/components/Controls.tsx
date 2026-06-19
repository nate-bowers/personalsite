"use client";

import { useQuality, setQuality } from "@/lib/quality";

/**
 * "Calmer seas" — the only scene control: it halves the heavy geometry for laptops
 * that run the 3D scene but not at 60fps. The live NOAA buoy always drives the ocean;
 * there is no manual override.
 */
export default function Controls() {
  const quality = useQuality();
  const calm = quality === "calm";

  return (
    <div
      className="fixed bottom-4 right-4 z-40 rounded-lg p-3"
      style={{
        background: "rgba(22,17,30,0.6)",
        color: "var(--ink)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        border: "1px solid rgba(255,255,255,0.12)",
      }}
    >
      <button
        type="button"
        role="switch"
        aria-checked={calm}
        onClick={() => setQuality(calm ? "full" : "calm")}
        className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-wide"
        style={{ color: "var(--ink)" }}
      >
        <span className="opacity-70">calmer seas</span>
        <span
          className="relative inline-flex h-3.5 w-7 items-center rounded-full transition-colors"
          style={{ background: calm ? "var(--accent)" : "rgba(255,255,255,0.2)" }}
        >
          <span
            className="absolute h-2.5 w-2.5 rounded-full bg-white transition-all"
            style={{ left: calm ? "16px" : "2px" }}
          />
        </span>
      </button>
    </div>
  );
}
