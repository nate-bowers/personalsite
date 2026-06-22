"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";

/**
 * Colophon — a small "about this site" docs page. NOT a station/buoy: it has no
 * NDBC number and isn't anchored in the water. It's a fixed, scrollable overlay
 * on the readable paper surface, reachable only from the index-nav link (or its
 * deep link /about-the-site). One way in, three ways out: the X, Escape, and the
 * browser back button (the X/Esc push "/", which is what the back button does
 * from a deep link). Focus is trapped while open and returned on close.
 * See DESIGN-PHASE2.md §clarity rule #6 — built standalone, not via StationPanel.
 */
export default function Colophon() {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const [closing, setClosing] = useState(false);

  const close = useCallback(() => {
    setClosing((already) => {
      if (already) return already;
      // Let the 0.32s slide finish before the route unmounts the overlay.
      window.setTimeout(() => router.push("/"), 340);
      return true;
    });
  }, [router]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    // Remember what had focus (the nav link), restore it on close if it survives.
    restoreRef.current = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input,textarea,select,[tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);

    panel.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === "Tab") {
        const f = focusables();
        if (f.length === 0) {
          e.preventDefault();
          return;
        }
        const first = f[0];
        const last = f[f.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (!active || !f.includes(active)) {
          e.preventDefault();
          (e.shiftKey ? last : first).focus();
        } else if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      // Restore focus to the trigger if it's still in the document.
      const el = restoreRef.current;
      if (el && document.contains(el)) el.focus();
    };
  }, [close]);

  return (
    <>
      <motion.div
        className="fixed inset-0 z-20"
        style={{ background: "rgba(0,0,0,0.16)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: closing ? 0 : 1 }}
        transition={{ duration: 0.22 }}
        onClick={close}
        aria-hidden
      />

      <motion.div
        ref={panelRef}
        data-animated
        role="dialog"
        aria-modal="true"
        aria-labelledby="colophon-title"
        tabIndex={-1}
        className="station-panel fixed inset-y-0 right-0 z-30 flex w-full max-w-[640px] flex-col outline-none md:w-[44%]"
        style={{ background: "var(--panel-bg)", color: "var(--panel-ink)" }}
        initial={{ x: "100%" }}
        animate={{ x: closing ? "100%" : 0 }}
        transition={{ type: "tween", duration: 0.32, ease: [0.22, 0.61, 0.36, 1] }}
      >
        {/* Header — reads like a docs masthead, not a station report. */}
        <div
          className="flex items-start justify-between gap-4 border-b px-6 py-5 sm:px-10"
          style={{ borderColor: "var(--panel-line)" }}
        >
          <div>
            <p
              className="font-mono text-xs uppercase tracking-wide"
              style={{ color: "var(--accent)" }}
            >
              About the site
            </p>
            <h2 id="colophon-title" className="font-display mt-1 text-3xl leading-none sm:text-4xl">
              How the coast is built
            </h2>
            <p className="font-mono mt-2 text-[11px]" style={{ color: "var(--panel-muted)" }}>
              What&apos;s real in it, and what&apos;s hidden
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close about the site"
            className="shrink-0 cursor-pointer rounded-full border p-2 leading-none transition-colors hover:bg-black/5"
            style={{ borderColor: "var(--panel-line)", color: "var(--panel-ink)" }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body — short, skimmable docs sections. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-7 sm:px-10">
          <div className="mx-auto max-w-2xl">
            <Section title="What this is">
              <p>
                A live 3D model of the Northern California coast, from Stinson Beach down
                to Big Sur, held at permanent golden hour. The terrain is real: built from
                USGS elevation data (AWS Terrarium tiles) into a committed heightmap, with
                the bay shaped from real bathymetry.
              </p>
              <p>
                The ocean is a Gerstner-wave surface driven by live NOAA NDBC readings from{" "}
                <Mono>station 46012</Mono> off Half Moon Bay, fetched through{" "}
                <Mono>/api/conditions</Mono>. The same conditions-to-wave mapping that
                shapes the water also places the buoys and the ferry, so they actually sit
                in the swell rather than floating on top of it. One shared exponential
                height-fog ties the whole scene into a single atmosphere; a little bloom
                gives the golden-hour glow.
              </p>
            </Section>

            <Section title="Built with">
              <ul className="font-mono space-y-1 text-[13px]" style={{ color: "var(--panel-muted)" }}>
                <li>· Next.js (App Router) + TypeScript</li>
                <li>· three.js · react-three-fiber · drei · postprocessing</li>
                <li>· Deployed on Vercel</li>
                <li>· Type: Instrument Serif · Schibsted Grotesk · IBM Plex Mono</li>
              </ul>
            </Section>

            <Section title="Three ways to see it">
              <p>
                Every visitor gets the same coast, at the fidelity their device can carry:
              </p>
              <ul className="space-y-1.5">
                <li>
                  <strong>Full</strong>: the complete 3D scene on a WebGL2 desktop.
                </li>
                <li>
                  <strong>Calm</strong>: a lighter tier on phones and weaker machines,
                  fewer trees, lower resolution, the same place.
                </li>
                <li>
                  <strong>Still</strong>: a static image of the same coast when there&apos;s
                  no WebGL2, with a quiet &ldquo;load the interactive version&rdquo; opt-in.
                </li>
              </ul>
            </Section>

            <Section title="Hidden in the water">
              <p style={{ color: "var(--panel-muted)" }}>
                A few things you might not catch on the first loop:
              </p>
              <ul className="space-y-2">
                <li>
                  A <strong>humpback whale</strong> breaches near the offshore buoy on
                  every load, then again about every 30 seconds.
                </li>
                <li>
                  A <strong>container ship</strong> crosses the far offshore shipping lane.
                </li>
                <li>
                  A clickable <strong>shark fin</strong> dives with a splash and resurfaces
                  somewhere else. It keeps a quiet tally.
                </li>
                <li>
                  The 404 is a hand-built <strong>message in a bottle</strong>.
                </li>
                <li>
                  Each station panel carries a live <strong>surf-cam</strong> link.
                </li>
                <li>
                  <strong>Number keys</strong> fly the camera to each buoy;{" "}
                  <Mono>0</Mono> returns home.
                </li>
                <li>
                  A <strong>&ldquo;calmer seas&rdquo;</strong> toggle drops the graphics tier
                  by hand.
                </li>
              </ul>
            </Section>

            <p className="font-mono mt-8 text-[11px]" style={{ color: "var(--panel-muted)" }}>
              Terrain rendered from USGS elevation data · ocean from NOAA Station 46012
            </p>
          </div>
        </div>
      </motion.div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-7">
      <h3 className="font-display mb-2 text-xl leading-tight">{title}</h3>
      <div className="station-prose">{children}</div>
    </section>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <code
      className="font-mono rounded px-1 py-0.5 text-[0.85em]"
      style={{ background: "rgba(0,0,0,0.05)", color: "var(--panel-ink)" }}
    >
      {children}
    </code>
  );
}
