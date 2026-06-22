# The Coast — Nate Bowers' portfolio

A portfolio that **is** a live 3D model of the Northern California coast — Stinson
Beach to Big Sur — rendered from real USGS elevation data at permanent golden
hour, with the ocean driven by a live NOAA buoy. Each content section is a
NOAA-style buoy anchored at a real surf spot; clicking one flies the rail-mounted
camera down to it and opens a station-report panel.

Live: **[natebowers.dev](https://natebowers.dev)**

## Stack

- **Next.js** (App Router) + **TypeScript**
- **three.js** · **@react-three/fiber** · **drei** · **@react-three/postprocessing** — the 3D coast
- **Tailwind** for layout, CSS variables for the locked golden-hour palette
- **Framer Motion** (`motion`) for the station panels
- Live ocean from **NOAA NDBC** buoy data via `/api/conditions` (fallback chain 46012 → 46026 → 46042 → defaults)
- Terrain built offline from AWS Terrarium tiles into an int16 heightmap committed under `public/terrain/`
- Deployed on **Vercel**

The scene runs one coast at three fidelity tiers — **full** 3D, **calm** 3D
(phones / weak machines, also driven at runtime by an FPS governor), and a
**static image** of the same coast (no-WebGL2 / reduced-motion). It never swaps
in a different renderer.

## Commands

```bash
pnpm dev            # local dev server
pnpm build          # production build
pnpm start          # serve the production build
pnpm build:terrain  # rebuild the committed heightmap from Terrarium tiles
pnpm test           # vitest (unit)
```

## Layout

```
app/                Next.js App Router (routes, layout, OG image, robots/sitemap)
app/components/     UI + the three/ scene components
lib/                terrain, NOAA conditions, Gerstner waves, quality tiers
content/*.md        station-panel content (frontmatter + prose)
scripts/build-terrain.mjs   offline terrain pipeline
public/terrain/     committed int16 heightmap
```

## Design

The art direction and engineering rules are canonical in **`DESIGN-PHASE2.md`**
(and enforced by the `lineup-design-system` skill). **`CLAUDE.md`** is the
working brief for agents. Golden hour is locked; the geography and data are real.
