import Link from "next/link";
import BottleOcean from "./components/BottleOcean";

export default function NotFound() {
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 px-6 pt-[6vh]">
      {/* station-report style card, legible over the live ocean */}
      <div
        className="relative w-full max-w-sm rounded-2xl border px-7 py-7 text-center"
        style={{
          color: "var(--ink)",
          borderColor: "rgba(251, 243, 228, 0.14)",
          background:
            "linear-gradient(180deg, rgba(30,58,82,0.46), rgba(46,42,79,0.52))",
          backdropFilter: "blur(14px) saturate(1.1)",
          WebkitBackdropFilter: "blur(14px) saturate(1.1)",
          boxShadow:
            "0 24px 70px rgba(22,42,62,0.45), inset 0 1px 0 rgba(255,217,160,0.16)",
        }}
      >
        <p
          className="font-mono text-xs uppercase tracking-[0.18em]"
          style={{ color: "var(--accent)" }}
        >
          STN 404
        </p>
        <h2 className="font-display mt-2 text-5xl leading-none">Lost at sea</h2>
        <p className="font-body mt-3 text-sm opacity-80">
          That station isn&apos;t on the chart. A note washed up instead.
        </p>

        <Link
          href="/"
          className="font-mono mt-6 inline-block rounded-md border px-4 py-2 text-sm transition-opacity hover:opacity-80"
          style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
        >
          ↩ back to the lineup
        </Link>
      </div>

      {/* the message in a bottle, bobbing on the water below the card */}
      <div className="mt-2 sm:mt-4 flex justify-center">
        <BottleOcean />
      </div>
    </div>
  );
}
