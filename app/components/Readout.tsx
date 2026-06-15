import type { Conditions } from "@/lib/ndbc";

/**
 * The signature element: an always-visible instrument panel showing the live
 * buoy numbers that drive the ocean. See DESIGN.md §2 "Signature element".
 * Server component — receives already-fetched conditions, never fetches.
 */
export default function Readout({ conditions }: { conditions: Conditions }) {
  const { stationId, waveHeightFt, periodS, observedAt, source } = conditions;
  const isOffline = source === "default";

  // Which break the buoy reports for, so the numbers aren't just an abstract ID.
  const BREAKS: Record<string, string> = {
    "46012": "Mavericks · Half Moon Bay",
    "46026": "San Francisco",
    "46042": "Monterey Bay",
  };
  const breakName = BREAKS[stationId];

  const fmt = (n: number | null, unit: string) => (n === null ? "—" : `${n}${unit}`);
  const observedLabel = observedAt
    ? new Date(observedAt).toLocaleTimeString("en-US", {
        timeZone: "America/Los_Angeles",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : null;

  return (
    <aside
      className="font-mono text-[13px] leading-tight"
      style={{ color: "var(--ink)", textShadow: "0 1px 12px rgba(22,42,62,0.55)" }}
      aria-label="Live ocean conditions"
    >
      {isOffline ? (
        <>
          <p style={{ color: "var(--accent)" }}>STN offline</p>
          <p className="opacity-80">showing typical conditions</p>
          <p className="opacity-60 mt-1">
            {fmt(waveHeightFt, " ft")} @ {fmt(periodS, "s")}
          </p>
        </>
      ) : (
        <>
          <p>
            <span style={{ color: "var(--accent)" }}>STN {stationId}</span>
            {breakName ? <span className="opacity-80"> · {breakName}</span> : null}
            {source === "fallback" && <span className="opacity-60"> · fallback</span>}
          </p>
          <p className="mt-0.5">
            {fmt(waveHeightFt, " ft")} @ {fmt(periodS, "s")}
          </p>
          <p className="opacity-70 mt-1">
            live from NOAA{observedLabel ? ` · ${observedLabel} PT` : ""}
          </p>
        </>
      )}
    </aside>
  );
}
