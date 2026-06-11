"use client";

import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";

export interface BuoyDef {
  slug: string;
  label: string;
  station: string;
}

/**
 * A buoy: a real <button> that opens its station. Label is ALWAYS visible in mono
 * beneath it (never hover-revealed). Hover lifts it and brightens the label; the
 * float bobs on its own phase; at night the light blinks. See DESIGN.md clarity rules.
 */
export default function Buoy({
  def,
  delay,
  className = "",
  style,
}: {
  def: BuoyDef;
  delay: number;
  className?: string;
  style?: CSSProperties;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      data-slug={def.slug}
      onClick={() => router.push(`/${def.slug}`)}
      aria-label={`Open ${def.label} — station ${def.station}`}
      className={`buoy group pointer-events-auto flex cursor-pointer flex-col items-center transition-transform duration-200 hover:-translate-y-1 ${className}`}
      style={style}
    >
      <span className="buoy-bob flex flex-col items-center" style={{ animationDelay: `${delay}s` }}>
        <svg width="30" height="42" viewBox="0 0 30 42" aria-hidden className="overflow-visible">
          <circle className="buoy-light" cx="15" cy="5" r="3" fill="var(--accent)" />
          <line x1="15" y1="8" x2="15" y2="17" stroke="var(--accent)" strokeWidth="2" />
          <path
            d="M5 18 h20 l-2.5 13 a7.5 7.5 0 0 1 -15 0 z"
            fill="var(--accent)"
            stroke="var(--accent)"
            strokeWidth="1"
          />
          <rect x="7.5" y="22.5" width="15" height="2.6" rx="1" fill="var(--panel-bg)" opacity="0.55" />
        </svg>
        <span
          className="buoy-label mt-1.5 rounded-full px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide opacity-90 transition-opacity group-hover:opacity-100"
          style={{
            // Reuse the readable panel pair so labels meet AA contrast over any water color.
            background: "color-mix(in srgb, var(--panel-bg) 80%, transparent)",
            color: "var(--panel-ink)",
          }}
        >
          {def.label}
        </span>
      </span>
    </button>
  );
}
