/**
 * Static fallback (DESIGN-PHASE2.md §3). Devices with no WebGL2 — or where the
 * live scene failed to present a frame — get a still image of the SAME
 * golden-hour coast, not a different renderer. Navigation is the DOM buoy field
 * (BuoyField, shown only in this tier) plus the index nav and header, which
 * render above this layer. The image is decorative; it carries no interaction.
 *
 * One landscape master (object-cover) handles every aspect ratio — portrait
 * phones crop to the centre, where the bay and landmarks sit.
 */
export default function StaticCoast() {
  return (
    <div className="fixed inset-0 z-0" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element -- full-bleed decorative backdrop, not content */}
      <img
        src="/coast-fallback.jpg"
        alt=""
        draggable={false}
        className="h-full w-full select-none object-cover"
        style={{ objectPosition: "center 42%" }}
      />
    </div>
  );
}
