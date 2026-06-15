---
name: lineup-design-system
description: The design system for Nate's portfolio ("The Lineup" → Phase 2 "The Coast" — a portfolio that is a live model of the Northern California coast). Use whenever writing or modifying ANY UI, styling, layout, copy, microcopy, animation, shader, or 3D scene in this repo. Enforces the LOCKED golden-hour palette, the three-font system, the clarity rules, the surf-report voice, and the banned moves. Read this AND DESIGN-PHASE2.md before touching markup, styles, copy, or the scene; do not invent colors, fonts, or motion outside it.
---

# The Coast — Design System (Phase 2)

Nate's portfolio **is a live model of the Northern California coast** (Stinson Beach → Big Sur), compressed into one stylized 3D scene at permanent golden hour, with the ocean driven by real NOAA buoy data. Content sections are NOAA buoys anchored at real surf spots. `DESIGN-PHASE2.md` is the Phase-2 canonical spec; `DESIGN.md` records v1. This skill is the enforcement summary — when in doubt, the spec docs win; keep them in sync.

Three pillars, in priority order: **(1) the data is real** (terrain from USGS elevation, water from the live buoy), **(2) the environment is a place** (golden-hour NorCal coast — atmosphere does the work), **(3) the interaction is calm** (click a buoy, camera flies to it, content surfaces; no free-look, no scroll-jacking).

> The complexity budget is spent in **exactly one place: the coast scene.** Type, panels, nav, and copy stay simple and predictable so the rich element reads as intentional, not busy.

---

## Palette — golden hour, LOCKED

The v1 four time-of-day palettes are **retired**. One art direction executed beautifully. Night mode is a backlog variant only. Consume these tokens (in `globals.css`) — never a raw hex in a component.

```
--sky-zenith #4A3D6B   deep violet overhead      --land-lit  #C97B4A  sunlit terrain
--sky-low    #E8895A   orange horizon band       --land-shade#3D3357  shadowed terrain
--sun-glow   #FFD9A0                              --fog       #D9A084  atmospheric haze
--water-far  #2E2A4F   violet sea at distance     --ink       #FBF3E4  warm off-white text
--water-near #1E3A52   deeper blue near camera    --accent    #FF7847  buoy orange (brand)
--glitter    #FFB870   sun path on water
```

Rules:
- **The realism is atmosphere, not geometry.** Exponential `--fog` between camera and far terrain, 3–4 ridgelines fading into haze, subtle bloom on the sun glitter only.
- `--accent` (`#FF7847`) marks buoys, the readout, and links — nothing else.
- The sun is low in the **west** over the water; warm rim light on ridgelines, long glitter path toward the sun.
- Panels use the readable paper surface tokens (`--panel-bg/-ink/-muted/-line`), not scene tokens.
- Do **not** re-introduce time-of-day switching or a palette `data-*` system. Golden hour is locked.

---

## Typography — three fonts, fixed roles (unchanged from v1)

```
DISPLAY → Instrument Serif   var(--font-display)  — name on landing + section titles in panels. Big, sparing.
BODY    → Schibsted Grotesk  var(--font-body)     — all reading text, nav, buttons, labels.
DATA    → IBM Plex Mono      var(--font-mono)     — and ONLY — readout, station IDs, place names, metadata. tabular-nums.
```

Scale: display 56–80px desktop / 36–44 mobile · body 17px/1.6 · mono 13px, letter-spacing 0.02em. Sentence case except station IDs and the terrain place-names (`STINSON · MAVERICKS · SANTA CRUZ · BIG SUR`, uppercase mono).

---

## Clarity rules (non-negotiable, carried from v1)

1. **Everything visible from the default shot.** All five buoys in frame from the default camera at every supported size — no hunting.
2. **Labels always on.** Each buoy's mono name is visible at all times (billboarded in 3D). Hover-to-reveal is banned.
3. **One interaction verb: click/tap.** No drag, no free-orbit, no scroll mechanics, no key combos. Buoys read as buttons — cursor pointer, hover brightens the label, visible focus ring, Enter activates.
4. **First-visit hint.** One quiet line ("tap a buoy") fades in once, then never again (localStorage).
5. **Index fallback.** A tiny mono index, bottom-left, plain links to all five sections — bulletproof for keyboard/screen-reader/recruiter. In 3D it also triggers the camera flights. Doubles as the footer.
6. **Panels: one way in, two ways out.** Buoy/index opens; X **and** Esc close; browser **back** also closes (and returns the camera). No nested nav. On wide viewports the panel is a right **40% side sheet** over the scene; compact (mobile) viewports keep the **bottom sheet**.
7. **Nothing load-bearing is hidden.** Content is never behind curiosity. Five seconds on the default shot still shows the name, what he does, and the live-data hook.
8. **One rich element.** The coast scene is the only place complexity is allowed.

### Signature element
The **conditions readout** — always-visible instrument panel, live buoy numbers + "Live from NOAA Station 46012 · driving this ocean." `source: "default"` → "STN offline · showing typical conditions." It never fakes freshness.

---

## Motion & the renderer split

- **Camera is on rails — full stop.** No free-look/orbit. Default shot: offshore, elevated 30–40°, coast diagonal in frame, slow ambient drift so the scene breathes. Buoy click → smooth eased fly (~1.8s) to a low shot; close flies home; mid-flight retargets cleanly (no snap).
- **Water:** Gerstner displacement driven by the live buoy via the **shared `oceanParams()` mapping** (`lib/ocean-map.ts`) — identical constants in 2D and 3D. Buoys heave/pitch/roll on the local wave function so they sit *in* the water.
- **One scene, three fidelity tiers (non-negotiable):** every visitor sees the same golden-hour coast — never a different renderer. **Full** 3D on WebGL2 desktops; **degraded-live** 3D (`quality="calm"`: fewer trees/segments, no bloom, DPR ≤ 1.25) on phones and narrow viewports; a **static still image of the same coast** (`StaticCoast`, with DOM buoys over it) when there's no WebGL2 **or** `prefers-reduced-motion`, and as the safety-net if the scene fails to present within ~8s. `RendererStage` owns this decision. The v1 2D `<Ocean>` is **retired**. Recruiters on locked-down laptops still get the coast — as an image.
- `prefers-reduced-motion` → the **static coast image** (zero motion), not the live scene. Always honor it.
- **No scroll-jacking, no forced animation tour.** Bloom glows the glitter, never the UI.

---

## Voice (unchanged)
Surf-report register, used lightly. Panels open with **one** report line, then get direct. No surf slang in project descriptions. Plain, concrete, dry. No hype, exclamation marks, or emoji in UI. Missing/offline data stated honestly. Site copy may note "terrain rendered from USGS elevation data."

---

## Banned moves — do not do these

1. **Hover-revealed labels or meaning.** Visible at rest (mobile/touch has no hover).
2. **Scroll-jacking, forced scroll tours, or free-orbit camera.** Camera is on rails; the visitor owns the scrollbar.
3. **Off-palette color.** Only the golden-hour tokens + `--accent`. No new accent, no second highlight hue.
4. **Re-introducing the time-of-day palette system / breaking the golden-hour lock.** (Reversed from v1 — golden hour is now the locked art direction.)
5. **Stranding weak devices** — gating the whole site behind WebGL, or shipping a blank/foreign fallback. No-WebGL2 and reduced-motion must still get the static coast image; mobile must still get the (degraded) scene. The v1 2D ocean is retired — do not reintroduce it.
6. **Wrong font for the role**; more than the three fonts.
7. **Faking data freshness** or hiding the offline/default state.
8. **Photoreal / low-poly-flat extremes, or a realism arms race** (SSR, heavy reflections). Stylized-realistic, atmosphere-led, under the perf budget (<150k tris, 60fps desktop / 30fps phone target).
9. Exclamation marks, emoji, marketing voice, or surf slang in project copy.

---

## Quality floor / pre-ship check
- [ ] Only golden-hour tokens used — no stray hex, `--accent` only on buoys/readout/links.
- [ ] Right font per role; mono for data/IDs/place-names only.
- [ ] All five buoys reachable + labeled from the default shot; index nav present.
- [ ] One verb (click); buoys are focusable with visible ring; Enter activates; deep links + back button work in the scene **and** the static fallback.
- [ ] Panel: side-sheet on wide viewports, bottom-sheet on compact; X + Esc + back all close; focus trapped then returned.
- [ ] Live scene on WebGL2 (calm on mobile/narrow); static coast image when no-WebGL2 or reduced-motion; each verified by forcing it. No v1 ocean.
- [ ] First paint not regressed — the 3D bundle is lazy-loaded behind the landing frame.
- [ ] Readout shows live data + honest offline state; AA contrast; alt text; OG image set.
