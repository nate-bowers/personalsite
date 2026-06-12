# The Coast — Nate's portfolio (Phase 2)

**A portfolio that is a live 3D model of the Northern California coast** — Stinson Beach to Big Sur, rendered from real USGS elevation data at permanent golden hour, with the ocean driven by real NOAA buoy data. Content sections are NOAA-style buoys anchored at real surf spots; clicking one flies the rail-mounted camera down to it and opens a station-report side panel.

- **Canonical spec:** `DESIGN-PHASE2.md` (art direction, geography, camera, water/buoys, budgets). `DESIGN.md` records v1 (the 2D ocean now serving as the fallback renderer). Read the Phase-2 spec before any scene work.
- **Enforcement:** the `lineup-design-system` skill (`.claude/skills/lineup-design-system/SKILL.md`) fires on any UI/style/copy/animation/scene change.

## Stack

Next.js (App Router) + TypeScript · three / @react-three/fiber / drei / @react-three/postprocessing for the 3D coast · Tailwind for layout, CSS variables for the palette · the v1 Canvas-2D ocean kept as the fallback renderer (reduced-motion, <768px, no WebGL2) · Framer Motion (`motion` package) for panels · NOAA NDBC data via `/api/conditions` · terrain built offline by `pnpm build:terrain` (AWS Terrarium tiles → int16 heightmap committed in `public/terrain/`) · deployed on Vercel.

## Non-negotiables

- **Golden hour, LOCKED.** The v1 four time-of-day palettes are retired; tokens live in `globals.css` and match the skill/spec exactly. Accent is `#FF7847` buoy orange. No off-palette color, no time-of-day switching.
- **The geography is real.** Terrain from USGS elevation, the bay from real bathymetry, buoys at real spots (About=Stinson, Projects=Mavericks, Ask=Station 46012 offshore, Resume=Steamer Lane, Contact=Big Sur). No synthetic coastlines or painted-over data bugs.
- **One Gerstner source of truth:** `lib/gerstner.ts` generates the water shader GLSL and feeds the CPU twin (buoys/ferry). Never fork the constants.
- **Fonts by role:** Instrument Serif (display) · Schibsted Grotesk (body) · IBM Plex Mono (data/IDs only).
- **Clarity:** all five buoys visible in the default shot; labels always on; one verb (click); buoys are real `<button>`s with visible focus; panels close via X **and** Esc **and** back button; camera on rails — no free-look.
- **No scroll-jacking.** Honor `prefers-reduced-motion` (2D fallback renderer).
- **The data is real** — and its offline/default state is shown honestly, never faked.

## Layout

```
/                  landing: 3D coast + 5 buoys + name + live readout + index nav
/about /projects   camera flies to the buoy; right-side station panel (40% desktop)
/ask /resume /contact   deep-linkable; back button closes the panel & flies home
/api/conditions    NDBC fetch + parse + fallback chain (46012 → 46026 → 46042 → defaults)
content/*.md       panel content (frontmatter + prose)
scripts/build-terrain.mjs   offline terrain pipeline (run: pnpm build:terrain)
```

## Skills in this repo (`.claude/skills/`)

- **lineup-design-system** — the design rules above (the one that matters).
- **frontend-design** — baseline visual-design taste for what the rules don't cover.
- **webapp-testing** — Playwright loop to launch the dev server, screenshot, and self-verify UI.
- **skill-creator** — for authoring future skills (e.g. a `noaa-data` skill in Phase 3).
