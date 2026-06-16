/**
 * Static fallback (DESIGN-PHASE2.md §3). Devices with no WebGL2 — or where the
 * live scene failed to present a frame — get a still image of the SAME
 * golden-hour coast, not a different renderer. Navigation is the DOM buoy field
 * (BuoyField, shown only in this tier) plus the index nav and header, which
 * render above this layer. The image is decorative; it carries no interaction.
 *
 * One landscape master (object-cover) handles every aspect ratio — portrait
 * phones crop to the centre, where the bay and landmarks sit.
 *
 * `onEnter` is provided only when the device actually has WebGL2 (so it landed
 * here via a slow first load or reduced-motion, not a hard incapability): we
 * surface a button to load the live, interactive scene on demand.
 */
export default function StaticCoast({ onEnter }: { onEnter?: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-0" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element -- full-bleed decorative backdrop, not content */}
        <img
          src="/coast-fallback.jpg"
          alt=""
          draggable={false}
          className="h-full w-full select-none object-cover"
          style={{
            objectPosition: "center 42%",
            // The baked still is darker/redder than the live scene; lift it toward
            // golden hour so the static tier reads as daytime, not "night mode".
            filter: "brightness(1.32) saturate(0.9) contrast(0.93)",
          }}
        />
      </div>
      {onEnter ? (
        <button
          type="button"
          onClick={onEnter}
          className="fixed bottom-16 left-1/2 z-[16] -translate-x-1/2 whitespace-nowrap rounded-full px-4 py-2 font-mono text-[11px] uppercase tracking-wide shadow-lg"
          style={{ background: "var(--accent)", color: "#231a33" }}
        >
          ▸ Load the interactive version
        </button>
      ) : null}
    </>
  );
}
