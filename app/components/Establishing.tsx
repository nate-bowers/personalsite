/**
 * The branded minimal state for the scene area while the 3D path streams
 * (DESIGN-PHASE2.md / FIX 5b): quiet mono line over the SeaSky gradient.
 * Rendered identically pre-hydration, during chunk load, and during terrain
 * streaming so the sequence reads as one continuous state.
 */
export default function Establishing() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 bottom-[42%] z-0 flex justify-center">
      <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-[color:var(--ink)]/60">
        establishing conditions...
      </span>
    </div>
  );
}
