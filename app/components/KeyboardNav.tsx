"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Number-key navigation (a11y / power-user affordance, no UI added): keys 1–5
 * fly to each buoy via the existing route-driven camera rails; 0 or Escape
 * returns home. Ignored while typing in a field or when a modifier is held, so
 * it never fights real input or browser shortcuts.
 */
const ORDER = ["about", "projects", "ask", "resume", "contact"] as const;

export default function KeyboardNav() {
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;

      if (e.key >= "1" && e.key <= "5") {
        const slug = ORDER[Number(e.key) - 1];
        if (slug) {
          e.preventDefault();
          router.push(`/${slug}`);
        }
      } else if (e.key === "0") {
        e.preventDefault();
        router.push("/");
      }
      // Escape is already handled by the open panel; no home-key conflict there.
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  // Pre-warm every station route once the scene is idle, so a buoy click / index
  // link opens its panel instantly — no per-click fetch, snappy on slow devices.
  useEffect(() => {
    const warm = () => ORDER.forEach((slug) => router.prefetch(`/${slug}`));
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(warm);
      return () => w.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(warm, 1200);
    return () => window.clearTimeout(t);
  }, [router]);

  return null;
}
