/**
 * Golden-hour gradient sea + sky for the 2D fallback renderer (and the base behind
 * the 3D canvas while it streams). Sky = zenith violet -> low orange band; water =
 * near deep-blue -> far violet. Tokens from DESIGN-PHASE2.md §1.
 */
export default function SeaSky() {
  return (
    <div aria-hidden className="fixed inset-0 -z-10">
      <div
        className="absolute inset-x-0 top-0 h-[45%]"
        style={{ background: "linear-gradient(to bottom, var(--sky-zenith), var(--sky-low))" }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-[55%]"
        style={{ background: "linear-gradient(to bottom, var(--water-far), var(--water-near))" }}
      />
    </div>
  );
}
