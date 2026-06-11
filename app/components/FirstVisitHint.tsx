"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * One quiet line under the subtitle: "tap a buoy". Fades in after 1.5s on the first
 * visit, disappears on the first interaction, and never returns (localStorage).
 * See DESIGN.md clarity rule #4.
 */
export default function FirstVisitHint() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (pathname !== "/") return;
    let hinted = false;
    try {
      hinted = localStorage.getItem("lineup-hinted") === "1";
    } catch {
      /* ignore */
    }
    if (hinted) return;

    const timer = window.setTimeout(() => setShow(true), 1500);
    const dismiss = () => {
      setShow(false);
      try {
        localStorage.setItem("lineup-hinted", "1");
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("pointerdown", dismiss, { once: true });
    window.addEventListener("keydown", dismiss, { once: true });

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("keydown", dismiss);
    };
  }, [pathname]);

  if (pathname !== "/" || !show) return null;

  return (
    <p
      className="mt-2 font-mono text-xs"
      style={{ color: "var(--accent)", animation: "fadein 0.6s ease forwards" }}
    >
      tap a buoy
    </p>
  );
}
