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
              {content.established}
              {content.location && content.location !== "—" ? ` · ${content.location}` : ""}
            </p>
            <p className="font-mono mt-1 text-[11px]" style={{ color: "var(--panel-muted)" }}>
              {content.report}
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
          Out of service
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
      <div className="station-prose" dangerouslySetInnerHTML={{ __html: content.bodyHtml }} />
      {content.links?.length ? <LinkRow links={content.links} /> : null}
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
        style={{ color: "var(--accent)" }}
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
  const stack = (project.stack ?? []).filter((s) => !isTodo(s));
  const metrics = (project.metrics ?? []).filter((m) => !isTodo(m));
  const links = (project.links ?? []).filter((l) => !isTodo(l.label) && !isTodo(l.href));

  return (
    <article className="rounded-xl border p-5" style={{ borderColor: "var(--panel-line)" }}>
      <h3 className="font-display text-xl leading-tight">{project.name}</h3>
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
            style={{ background: "var(--accent)", color: "#fff" }}
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
              <a href={content.pdf} style={{ color: "var(--accent)" }}>
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
            style={{ borderColor: "var(--panel-line)", color: "var(--accent)" }}
          >
            {l.label}
            {external ? " ↗" : ""}
          </a>
        );
      })}
    </div>
  );
}
