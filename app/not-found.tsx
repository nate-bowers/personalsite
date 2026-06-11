import Link from "next/link";

export default function NotFound() {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center px-6">
      <div className="text-center" style={{ color: "var(--ink)" }}>
        <p className="font-mono text-xs uppercase tracking-wide" style={{ color: "var(--accent)" }}>
          STN 404
        </p>
        <h2 className="font-display mt-2 text-5xl leading-none">Lost at sea</h2>
        <p className="font-body mt-3 opacity-80">That station isn&apos;t on the chart.</p>
        <Link
          href="/"
          className="font-mono mt-6 inline-block rounded-md border px-4 py-2 text-sm transition-opacity hover:opacity-80"
          style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
        >
          ↩ back to the lineup
        </Link>
      </div>
    </div>
  );
}
