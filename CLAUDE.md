# The Lineup — Nate's portfolio

**A portfolio that is a live model of the Pacific.** The whole page is an ocean driven by real NOAA buoy data; content sections are buoys floating on the water. Sky/water palette tracks real California time. Interaction is calm — click a buoy, a station-report panel slides up, leave when you want.

- **Canonical spec:** `DESIGN.md` (concept, palettes, type, layout, voice, clarity rules, data layer). Read it before any UI work.
- **Enforcement:** the `lineup-design-system` skill (`.claude/skills/lineup-design-system/SKILL.md`) fires on any UI/style/copy/animation change.

## Stack

Next.js (App Router) + TypeScript · Tailwind for layout, CSS variables for the palette · Canvas 2D ocean in v1 (**no 3D/WebGL** until Phase 2) · Framer Motion (`motion` package) for panels · NOAA NDBC data via a `/api/conditions` route handler · deployed on Vercel.

## Non-negotiables

- **Four time-of-day palettes** (dawn/day/golden/night) switched by a `<body>` class from the current America/Los_Angeles hour, 2s crossfade (instant under reduced-motion). Brand accent is the **buoy-orange `#D96F32` family**, per-palette `--accent`. No off-palette color.
- **Fonts by role:** Instrument Serif (display) · Schibsted Grotesk (body) · IBM Plex Mono (data/IDs only).
- **Clarity:** all five buoys visible in the first viewport with no scrolling at 360/768/1440; labels always on (no hover-reveal); one verb (click); buoys are real `<button>`s with visible focus; panels close via X **and** Esc **and** back button.
- **The ocean is the only rich element.** Everything else stays simple.
- **No scroll-jacking.** Honor `prefers-reduced-motion` (static sea, no bob/blink).
- **The data is real** — and its offline/default state is shown honestly, never faked.

## Layout

```
/                  landing: ocean + 5 buoys + name + live readout + index nav
/about /projects   each opens a station-report panel (slides up ~75vh; full-screen mobile)
/ask /resume /contact   deep-linkable; back button closes the panel
/api/conditions    NDBC fetch + parse + fallback chain (46012 → 46026 → 46042 → defaults)
content/*.md       panel content (frontmatter + prose)
```

## Skills in this repo (`.claude/skills/`)

- **lineup-design-system** — the design rules above (the one that matters).
- **frontend-design** — baseline visual-design taste for what the rules don't cover.
- **webapp-testing** — Playwright loop to launch the dev server, screenshot, and self-verify UI.
- **skill-creator** — for authoring future skills (e.g. a `noaa-data` skill in Phase 3).
