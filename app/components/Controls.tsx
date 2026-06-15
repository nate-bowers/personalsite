"use client";

import type { Conditions } from "@/lib/ndbc";
import { useQuality, setQuality } from "@/lib/quality";

function Row({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-2 font-mono text-[11px]">
      <span className="w-12 shrink-0 uppercase opacity-70">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-1 flex-1 cursor-pointer"
        style={{ accentColor: "var(--accent)" }}
        aria-label={`${label} ${value}${unit}`}
      />
      <span className="w-12 shrink-0 text-right tabular-nums">
        {value}
        {unit}
      </span>
    </label>
  );
}

/**
 * "Take the controls" — override the live buoy data feeding the ocean (the Phase 2c
 * physics panel). Drag wave height / period / wind and watch the sea respond; "return
 * to live" snaps back to the real NOAA reading.
 */
export default function Controls({
  live,
  override,
  setOverride,
}: {
  live: Conditions;
  override: Conditions | null;
  setOverride: (c: Conditions | null) => void;
}) {
  const engaged = override !== null;
  const c: Conditions =
    override ?? {
      ...live,
      waveHeightFt: live.waveHeightFt ?? 3,
      periodS: live.periodS ?? 10,
    };
  const set = (key: keyof Conditions, val: number) => setOverride({ ...c, [key]: val });

  const quality = useQuality();
  const calm = quality === "calm";

  return (
    <div
      className="fixed bottom-4 right-4 z-40 w-[232px] rounded-lg p-3"
      style={{
        background: "rgba(22,17,30,0.6)",
        color: "var(--ink)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        border: "1px solid rgba(255,255,255,0.12)",
      }}
    >
      {!engaged ? (
        <button
          type="button"
          onClick={() => setOverride(c)}
          className="w-full cursor-pointer rounded px-2 py-1.5 font-mono text-[11px] uppercase tracking-wide"
          style={{ background: "var(--accent)", color: "#1a1320" }}
        >
          ▸ take the controls
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="font-mono text-[10px] uppercase tracking-wide" style={{ color: "var(--accent)" }}>
            ● driving the ocean
          </p>
          <Row label="wave" value={c.waveHeightFt ?? 3} min={1} max={20} step={0.5} unit="ft" onChange={(v) => set("waveHeightFt", v)} />
          <Row label="period" value={c.periodS ?? 10} min={4} max={20} step={0.5} unit="s" onChange={(v) => set("periodS", v)} />
          <button
            type="button"
            onClick={() => setOverride(null)}
            className="mt-0.5 w-full cursor-pointer rounded border px-2 py-1 font-mono text-[11px] uppercase tracking-wide"
            style={{ borderColor: "rgba(255,255,255,0.25)", color: "var(--ink)" }}
          >
            ↩ return to live
          </button>
        </div>
      )}

      {/* Calmer seas — halves the heavy geometry for laptops that run the 3D
          scene but not at 60fps. */}
      <button
        type="button"
        role="switch"
        aria-checked={calm}
        onClick={() => setQuality(calm ? "full" : "calm")}
        className="mt-2.5 flex w-full items-center justify-between border-t pt-2 font-mono text-[10px] uppercase tracking-wide"
        style={{ borderColor: "rgba(255,255,255,0.12)", color: "var(--ink)" }}
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
