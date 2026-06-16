import Link from "next/link";
import { SECTIONS } from "@/lib/content";

/**
 * The bulletproof fallback nav: a tiny mono index, bottom-left, plain links to all
 * five sections. Works for keyboard, screen readers, and the zero-curiosity recruiter.
 * Doubles as the footer. See DESIGN.md clarity rule #5.
 */
export default function IndexNav() {
  return (
    <nav
      aria-label="Sections"
      className="fixed bottom-3 left-4 z-[15] font-mono text-xs"
      style={{ color: "var(--ink)" }}
    >
      <ul className="flex flex-wrap gap-x-3 gap-y-1">
        {SECTIONS.map((s) => (
          <li key={s.slug}>
            <Link
              href={`/${s.slug}`}
              className="opacity-70 transition-opacity hover:opacity-100 hover:underline"
              style={{ textDecorationColor: "var(--accent)" }}
            >
              {s.slug}
            </Link>
          </li>
        ))}
        {/* The colophon ("about this site") sits alongside the sections — it reads
            as one of the others, but it's a docs page, not a buoy/station. */}
        <li>
          <Link
            href="/colophon"
            className="opacity-70 transition-opacity hover:opacity-100 hover:underline"
            style={{ textDecorationColor: "var(--accent)" }}
          >
            colophon
          </Link>
        </li>
      </ul>
    </nav>
  );
}
