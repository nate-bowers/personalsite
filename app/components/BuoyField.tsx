"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Buoy, { type BuoyDef } from "./Buoy";
import { useRenderMode } from "./RendererStage";
import { stationVisible } from "@/lib/visibility";

/**
 * Places the active buoys (static tier). Desktop: scattered across the water
 * (absolute, per the wireframe). Mobile: a centered vertical column. All sit inside
 * the initial viewport with no scrolling at every breakpoint (DESIGN.md clarity
 * rule #1). Hidden stations (see lib/visibility.ts) drop out.
 */
const BUOYS: (BuoyDef & { delay: number; left: string; top: string })[] = [
  { slug: "about", label: "About me", station: "STN 2004", delay: 0.0, left: "12%", top: "64%" },
  { slug: "projects", label: "Projects", station: "STN 46012", delay: 0.7, left: "45%", top: "60%" },
  { slug: "ask", label: "Ask Nate", station: "STN 0000", delay: 1.3, left: "70%", top: "26%" },
  { slug: "resume", label: "Resume", station: "STN 2028", delay: 0.4, left: "28%", top: "62%" },
  { slug: "contact", label: "Contact me", station: "STN 1", delay: 1.0, left: "62%", top: "66%" },
];

export default function BuoyField() {
  const ref = useRef<HTMLDivElement>(null);
  const mode = useRenderMode();
  const pathname = usePathname();

  // When a panel closes (route returns to "/"), return focus to the buoy that
  // opened it (DESIGN.md clarity #6). The buoys live in the persistent layout and
  // never remount, so this keys off the pathname rather than mount.
  useEffect(() => {
    if (pathname !== "/") return;
    let slug: string | null = null;
    try {
      slug = sessionStorage.getItem("lineup-return");
      if (slug) sessionStorage.removeItem("lineup-return");
    } catch {
      /* ignore */
    }
    if (slug && ref.current) {
      ref.current.querySelector<HTMLElement>(`[data-slug="${slug}"]`)?.focus();
    }
  }, [pathname]);

  // In the live scene the buoys are 3D; this DOM buoy field is the static fallback.
  if (mode !== "static") return null;

  // Mobile: column starts higher so all five fit with no scroll at 360px.
  // Desktop: absolute scatter is positioned within the top-[40%] container.
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 top-[24%] z-10 md:top-[40%]">
      <div
        ref={ref}
        className="relative flex h-full flex-col items-center justify-center gap-3 px-6 md:block md:gap-0 md:px-0"
      >
        {BUOYS.filter((b) => stationVisible(b.slug)).map((b) => (
          <Buoy
            key={b.slug}
            def={b}
            delay={b.delay}
            className="static md:absolute md:-translate-x-1/2"
            style={{ left: b.left, top: b.top }}
          />
        ))}
      </div>
    </div>
  );
}
