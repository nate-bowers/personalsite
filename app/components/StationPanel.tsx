"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import type { ProjectCard, StationContent } from "@/lib/content";
import { useRenderState } from "./RendererStage";

/**
 * A station report panel: slides up from the bottom (~75vh desktop, full-screen
 * mobile), the ocean staying visible above it. One way in (buoy / index link),
 * two ways out (X or Esc, plus the browser back button). Focus is trapped while
 * open and returned to the buoy on close. See DESIGN.md §2 + clarity rule #6.
 */
export default function StationPanel({ content }: { content: StationContent }) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const [closing, setClosing] = useState(false);

  // Wide viewport: a right-side 40% sheet over the scene. Compact (mobile): bottom sheet.
  const side = !useRenderState().compact;

  const close = useCallback(() => {
    setClosing((already) => {
      if (already) return already;
      try {
        sessionStorage.setItem("lineup-return", content.slug);
      } catch {
        /* ignore */
      }
      // Let the 0.32s slide-down finish before the route unmounts the panel.
      window.setTimeout(() => router.push("/"), 340);
      return true;
    });
  }, [content.slug, router]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const focusables = () =>
      Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input,textarea,select,[tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);

    // Move focus into the dialog on open.
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
          // Focus is still on the dialog container (or escaped the panel) — pull it to an edge.
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
    return () => document.removeEventListener("keydown", onKey);
  }, [close]);

  const titleId = `station-${content.slug}-title`;

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
        key={side ? "side" : "bottom"}
        ref={panelRef}
        data-animated
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={
          side
            ? "station-panel fixed inset-y-0 right-0 z-30 flex w-full max-w-[640px] flex-col outline-none md:w-[40%]"
            : "station-panel fixed inset-x-0 bottom-0 z-30 flex h-dvh flex-col outline-none md:h-[78vh] md:rounded-t-2xl"
        }
        style={{ background: "var(--panel-bg)", color: "var(--panel-ink)" }}
        initial={side ? { x: "100%" } : { y: "100%" }}
        animate={side ? { x: closing ? "100%" : 0 } : { y: closing ? "100%" : 0 }}
        transition={{ type: "tween", duration: 0.32, ease: [0.22, 0.61, 0.36, 1] }}
      >
        {/* Station header — mimics an NDBC station page. */}
        <div
          className="flex items-start justify-between gap-4 border-b px-6 py-5 sm:px-10"
          style={{ borderColor: "var(--panel-line)" }}
        >
          <div>
            <p className="font-mono text-xs uppercase tracking-wide" style={{ color: "var(--accent)" }}>
              {content.station}
            </p>
            <h2 id={titleId} className="font-display mt-1 text-3xl leading-none sm:text-4xl">
              {content.title}
            </h2>
            <p className="font-mono mt-2 text-[11px]" style={{ color: "var(--panel-muted)" }}>
              {[content.established, content.location && content.location !== "—" ? content.location : ""]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close station report"
            className="shrink-0 cursor-pointer rounded-full border p-2 leading-none transition-colors hover:bg-black/5"
            style={{ borderColor: "var(--panel-line)", color: "var(--panel-ink)" }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-10">
          <div className="mx-auto max-w-2xl">
            <StationBody content={content} />
          </div>
        </div>
      </motion.div>
    </>
  );
}

function StationBody({ content }: { content: StationContent }) {
  const cam = content.surfCam ? <LiveCamPill cam={content.surfCam} /> : null;

  if (content.offline) {
    return (
      <div>
        <div
          className="font-mono mb-6 inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs uppercase tracking-wide"
          style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
        >
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--accent)" }} />
          Not built yet
        </div>
        {cam}
        <div className="station-prose" dangerouslySetInnerHTML={{ __html: content.bodyHtml }} />
      </div>
    );
  }

  if (content.projects?.length) {
    return (
      <div>
        {cam}
        {content.bodyHtml && (
          <div className="station-prose mb-7" dangerouslySetInnerHTML={{ __html: content.bodyHtml }} />
        )}
        <div className="flex flex-col gap-5">
          {content.projects.map((p) => (
            <ProjectCardView key={p.name} project={p} />
          ))}
        </div>
      </div>
    );
  }

  if (content.slug === "resume") {
    return <ResumeView content={content} cam={cam} />;
  }

  return (
    <div>
      {cam}
      {content.bodyHtml ? (
        <div className="station-prose" dangerouslySetInnerHTML={{ __html: content.bodyHtml }} />
      ) : null}
      {content.links?.length ? (
        content.slug === "contact" ? (
          <ContactLinks links={content.links} />
        ) : (
          <LinkRow links={content.links} />
        )
      ) : null}
    </div>
  );
}

/**
 * A broadcast-style "LIVE" chip linking to a real public surf cam (or, for the
 * offshore data buoy, its NDBC station page). Pulsing accent dot, mono uppercase
 * label, opens in a new tab. Built from the panel tokens only — no off-palette color.
 */
function LiveCamPill({ cam }: { cam: { label: string; href: string } }) {
  return (
    <a
      href={cam.href}
      target="_blank"
      rel="noopener noreferrer"
      className="group mb-6 inline-flex items-center gap-2.5 rounded-full border py-2 pl-3 pr-3.5 transition-colors"
      style={{
        borderColor: "var(--panel-line)",
        background: "var(--panel-bg)",
        color: "var(--panel-ink)",
      }}
    >
      {/* Pulsing broadcast dot: a soft expanding ring under a solid accent core. */}
      <span className="relative flex h-2.5 w-2.5 items-center justify-center">
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{ background: "var(--accent)" }}
          initial={{ scale: 1, opacity: 0.55 }}
          animate={{ scale: 2.4, opacity: 0 }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
          aria-hidden
        />
        <span className="relative h-2.5 w-2.5 rounded-full" style={{ background: "var(--accent)" }} />
      </span>
      <span
        className="font-mono text-xs font-medium uppercase tracking-[0.12em]"
        style={{ color: "var(--accent-ink)" }}
      >
        {cam.label}
      </span>
      <span
        className="font-mono text-xs transition-transform group-hover:translate-x-0.5"
        style={{ color: "var(--panel-muted)" }}
        aria-hidden
      >
        ↗
      </span>
    </a>
  );
}

function ProjectCardView({ project }: { project: ProjectCard }) {
  // Never render unfinished placeholders: drop any TODO-prefixed entries.
  const isTodo = (s: string) => /^\s*todo/i.test(s);
  const tagline = project.tagline && !isTodo(project.tagline) ? project.tagline : "";
  const date = project.date && !isTodo(project.date) ? project.date : "";
  const stack = (project.stack ?? []).filter((s) => !isTodo(s));
  const metrics = (project.metrics ?? []).filter((m) => !isTodo(m));
  const links = (project.links ?? []).filter((l) => !isTodo(l.label) && !isTodo(l.href));

  return (
    <article className="rounded-xl border p-5" style={{ borderColor: "var(--panel-line)" }}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-xl leading-tight">{project.name}</h3>
        {date ? (
          <span className="font-mono shrink-0 text-[11px]" style={{ color: "var(--panel-muted)" }}>
            {date}
          </span>
        ) : null}
      </div>
      {tagline ? <p className="mt-1.5">{tagline}</p> : null}
      {stack.length ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {stack.map((s) => (
            <li
              key={s}
              className="font-mono rounded border px-2 py-0.5 text-[11px]"
              style={{ borderColor: "var(--panel-line)", color: "var(--panel-muted)" }}
            >
              {s}
            </li>
          ))}
        </ul>
      ) : null}
      {metrics.length ? (
        <ul className="font-mono mt-3 space-y-0.5 text-[12px]" style={{ color: "var(--panel-muted)" }}>
          {metrics.map((m) => (
            <li key={m}>· {m}</li>
          ))}
        </ul>
      ) : null}
      {links.length ? <LinkRow links={links} /> : null}
    </article>
  );
}

function ResumeView({ content, cam }: { content: StationContent; cam: ReactNode }) {
  return (
    <div>
      {cam}
      {content.facts?.length ? (
        <ul className="font-mono mb-6 space-y-1 text-[13px]" style={{ color: "var(--panel-muted)" }}>
          {content.facts.map((f) => (
            <li key={f}>· {f}</li>
          ))}
        </ul>
      ) : null}

      {content.bodyHtml && (
        <div className="station-prose mb-6" dangerouslySetInnerHTML={{ __html: content.bodyHtml }} />
      )}

      {content.pdf && (
        <>
          <a
            href={content.pdf}
            download
            className="font-mono inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm"
            style={{ background: "var(--accent-ink)", color: "#fff" }}
          >
            ↓ Download resume (PDF)
          </a>
          <object
            data={content.pdf}
            type="application/pdf"
            className="mt-5 h-[60vh] w-full rounded-lg border"
            style={{ borderColor: "var(--panel-line)" }}
            aria-label="Resume PDF preview"
          >
            <p className="font-mono p-4 text-sm" style={{ color: "var(--panel-muted)" }}>
              Your browser can&apos;t display the embedded PDF.{" "}
              <a href={content.pdf} style={{ color: "var(--accent-ink)" }}>
                Open it in a new tab.
              </a>
            </p>
          </object>
        </>
      )}
    </div>
  );
}

function LinkRow({ links }: { links: { label: string; href: string }[] }) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {links.map((l) => {
        const external = l.href.startsWith("http");
        return (
          <a
            key={l.href}
            href={l.href}
            target={external ? "_blank" : undefined}
            rel={external ? "noopener noreferrer" : undefined}
            className="font-mono rounded-md border px-3 py-1.5 text-sm transition-colors hover:border-current"
            style={{ borderColor: "var(--panel-line)", color: "var(--accent-ink)" }}
          >
            {l.label}
            {external ? " ↗" : ""}
          </a>
        );
      })}
    </div>
  );
}

/**
 * Contact methods as a tall board that fills the panel: each method is a
 * full-width row (brand glyph · large label · mono handle) split by hairlines
 * and sized to divide the height evenly. Hovering one row brings it forward —
 * it grows and brightens while the others recede — so the eye always has a
 * single focus. Same panel tokens and accent-link convention as the rest of
 * the station; the grow/slide motion is gated behind `motion-safe`, so
 * reduced-motion visitors get the static board. Used only for the Contact station.
 */
function ContactLinks({ links }: { links: { label: string; href: string }[] }) {
  return (
    <ul
      className="mt-6 flex min-h-[60vh] flex-col"
      style={{ borderBottom: "1px solid var(--panel-line)" }}
    >
      {links.map((l) => {
        const external = l.href.startsWith("http");
        const icon = CONTACT_ICONS[contactKind(l.href)];
        return (
          <li key={l.href} className="flex-1" style={{ borderTop: "1px solid var(--panel-line)" }}>
            <a
              href={l.href}
              target={external ? "_blank" : undefined}
              rel={external ? "noopener noreferrer" : undefined}
              className="group/row flex h-full items-center gap-5 rounded-md px-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--accent)] motion-safe:transition-transform motion-safe:hover:translate-x-1.5"
              style={{ color: "var(--accent)" }}
            >
              {icon ? (
                <span className="shrink-0 [&>svg]:h-6 [&>svg]:w-6" aria-hidden>
                  {icon}
                </span>
              ) : null}
              <span className="flex min-w-0 flex-col gap-1">
                <span className="origin-left text-3xl leading-none transition-transform duration-300 motion-safe:group-hover/row:scale-[1.08] sm:text-4xl">
                  {l.label}
                </span>
                <span className="font-mono truncate text-xs" style={{ color: "var(--panel-muted)" }}>
                  {contactDetail(l.href)}
                </span>
              </span>
              {external ? (
                <span
                  className="font-mono ml-auto shrink-0 text-sm opacity-60 transition-transform duration-300 motion-safe:group-hover/row:translate-x-1"
                  aria-hidden
                >
                  ↗
                </span>
              ) : null}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

/** Human-readable handle for a contact href: drop the mailto:/protocol and any www. */
function contactDetail(href: string): string {
  if (href.startsWith("mailto:")) return href.slice(7);
  return href.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
}

/** Map a contact href to its brand-glyph key. */
function contactKind(href: string): "email" | "github" | "linkedin" | "x" | "link" {
  if (href.startsWith("mailto:")) return "email";
  if (/github\.com/i.test(href)) return "github";
  if (/linkedin\.com/i.test(href)) return "linkedin";
  if (/(?:\/\/)?(?:www\.)?(?:x|twitter)\.com/i.test(href)) return "x";
  return "link";
}

/** Brand glyphs (Simple Icons paths) + a solid envelope, sized for the contact list. */
const CONTACT_ICONS: Record<string, ReactNode> = {
  email: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M1.5 8.67v8.58a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3V8.67l-8.928 5.493a3 3 0 0 1-3.144 0L1.5 8.67Z" />
      <path d="M22.5 6.908V6.75a3 3 0 0 0-3-3h-15a3 3 0 0 0-3 3v.158l9.714 5.978a1.5 1.5 0 0 0 1.572 0L22.5 6.908Z" />
    </svg>
  ),
  github: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.014 2.898-.014 3.293 0 .322.216.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  ),
  linkedin: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  ),
  x: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
    </svg>
  ),
};
