# The Lineup — DESIGN.md

> Canonical design + data reference for this repo (Sections 2–4 of the build plan).
> Every session reads this. The `lineup-design-system` skill enforces it.

**One sentence:** a portfolio that is a live model of the Pacific.

Three pillars, in priority order:

1. **The data is real.** Wave behavior on screen maps to actual current conditions at a NOAA buoy. Ships in v1, not later.
2. **The environment is alive.** Sky and water palette track real time in California. The site at 7am and at 11pm are two different paintings.
3. **The interaction is calm.** No scroll-jacking, no forced animation tour. Visitors click buoys, content surfaces, they leave when they want.

What this is **not**: a game, a 3D demo reel, or a scroll experience. The ocean is the stage, the content is the show.

---

## 2. Design direction

### Signature element

The **conditions readout**: a small instrument-style panel, always visible, showing live buoy numbers (wave height, period, wind) with a one-line caption: "Live from NOAA Station 46012 · driving this ocean." Everything else stays quiet so this one element carries the story.

### Palette — four time-of-day palettes

The site picks one based on the current hour in **America/Los_Angeles**, with soft crossfades at boundaries. Tokens are CSS variables so the swap is one class on `<body>` (`palette-dawn`, `palette-day`, `palette-golden`, `palette-night`).

**Dawn (5:00–9:00)**
```css
--sky-top: #2E3A59;     /* slate pre-dawn */
--sky-horizon: #E8A87C; /* peach band */
--water-deep: #1B2A41;
--water-light: #5C7A99;
--ink: #F5EFE6;         /* warm off-white text */
--accent: #E8A87C;
```

**Day (9:00–17:00)**
```css
--sky-top: #BFD9E8;     /* washed blue */
--sky-horizon: #E9F1F2;
--water-deep: #18435A;
--water-light: #4E8BA8;
--ink: #11202B;         /* deep ink text */
--accent: #D96F32;      /* buoy orange */
```

**Golden (17:00–20:00)**
```css
--sky-top: #5C4A6E;     /* violet */
--sky-horizon: #F2B279; /* gold band */
--water-deep: #2A2440;
--water-light: #8A6E9E;
--ink: #FBF3E4;
--accent: #F2B279;
```

**Night (20:00–5:00)**
```css
--sky-top: #060A14;     /* near black */
--sky-horizon: #101A2E;
--water-deep: #04070F;
--water-light: #16263F; /* moonlit crests */
--ink: #D9E2EC;
--accent: #FF7847;      /* blinking buoy lights */
```

**Buoy orange (`#D96F32` family) is the constant brand color** across all four palettes. Use the per-palette `--accent` for buoy markers, readout accents, and links — and nothing else.

### Typography

Three roles, all free via Google Fonts (`next/font`):

- **Display: Instrument Serif** → CSS var `--font-display`. Big, sparing — only the name on the landing view and section titles inside panels. Italic for one or two editorial moments max.
- **Body: Schibsted Grotesk** → `--font-body`. All reading text. Clean without being Inter.
- **Data: IBM Plex Mono** → `--font-mono`. The conditions readout, station IDs, project metadata, timestamps. This face does the "instrument" feel. Tabular numerals on.

Scale: display 56–80px desktop / 36–44 mobile · body 17px / 1.6 · mono 13px with letter-spacing 0.02em. Sentence case everywhere except station IDs.

### Layout concept

```
┌──────────────────────────────────────────────┐
│  NATE [LASTNAME]              [readout panel] │  <- name top-left, instrument top-right
│  applied math + econ · builds with data       │
│                                                │
│         ~~~~~~~~ horizon line ~~~~~~~~          │
│   ◉ About      ◉ Projects      ◉ Ask Nate      │  <- buoys bobbing on the water
│ ~~~~~~~~~~ animated wave layers ~~~~~~~~~~~~    │
│         ◉ Resume        ◉ Contact              │
│ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~    │
└──────────────────────────────────────────────┘
```

Clicking a buoy slides up a **station report panel** from the bottom (≈75vh, ocean stays visible above). Panel header mimics an NDBC station page: station ID, "established" date, location. Content inside is normal readable prose and cards. Close returns to the ocean. URL updates (`/projects`, `/about`) so sections are deep-linkable.

Mobile: buoys stack into a vertical column on the water, panels go full-screen. The readout collapses to a single line under the name.

### Voice

Surf-report register, used lightly. Panels open with one line of report copy ("Projects · 4 active stations · all reporting") then drop the bit and get direct. **No surf slang in actual project descriptions** — recruiters need to parse those fast.

### Clarity rules (non-negotiable)

The site rewards curiosity but never requires it.

1. **Everything is visible from the first frame.** All five buoys sit in the initial viewport on every screen size. No scrolling/hovering/wandering to discover a section.
2. **Labels are always on.** Every buoy shows its name in mono beneath it at all times. Hover-to-reveal labels are banned.
3. **One interaction verb.** Click (or tap). No drag, no scroll mechanics, no key combos in v1. A buoy looks like a button: cursor changes, lifts slightly on hover, label brightens, focus ring on keyboard.
4. **First-visit hint.** A single quiet line fades in under the subtitle after 1.5s: "tap a buoy." Disappears after the first click, never shows again (localStorage flag).
5. **The index fallback.** A tiny mono text index in the bottom-left lists all five sections as plain links (about · projects · ask · resume · contact). Bulletproof nav for zero-curiosity recruiters and screen readers. Doubles as the footer.
6. **Panels: one way in, two ways out.** Click buoy or index link to open; X button or Esc to close; browser back also closes. No nested navigation deeper than one level.
7. **Nothing load-bearing is hidden.** Easter eggs may be hidden; content never is. 5 seconds on the landing view still shows your name, what you do, and the live-data hook.
8. **The complexity budget is spent in exactly one place: the ocean.** Every other element (type, panels, nav) stays simple and predictable.

### Quality floor

Responsive to 360px · keyboard navigable (buoys are buttons, focus visible) · `prefers-reduced-motion` swaps animated waves for a static gradient sea · semantic HTML inside panels · alt text on everything · OG image so the link unfurls well.

---

## 3. Site architecture

Five buoys:

| Buoy | Route | Station ID gag | Content |
|---|---|---|---|
| About | `/about` | STN 2004 (birth year, adjust) | Short bio, the Bay Area → Vanderbilt arc, photo, interests strip |
| Projects | `/projects` | STN 46012 | Project cards: dailybriefmail, SurfScore, Clean View Crew, AI Action Summit research. Each card: name, one-liner, stack tags in mono, 2–3 metric lines, links |
| Ask Nate | `/ask` | STN 0000 (offline) | v1 placeholder: panel styled like an out-of-service station page. "Station 0000 · RAG agent · deploying soon." |
| Resume | `/resume` | STN 2028 (grad year) | Embedded PDF view + download button + plain-text key facts |
| Contact | `/contact` | STN 1 | Email, GitHub, LinkedIn, dailybriefmail link. No form in v1, mailto is fine |

---

## 4. Data layer

**Source:** NOAA NDBC realtime feed. Plain text, no API key.
`https://www.ndbc.noaa.gov/data/realtime2/{STATION}.txt`

**Stations:** primary `46012` (Half Moon Bay), fallback `46026` (San Francisco), second fallback `46042` (Monterey Bay). Buoys go offline for maintenance regularly — the fallback chain is not optional.

**Fields to parse** from the most recent row: `WVHT` (significant wave height, meters), `DPD` (dominant period, seconds), `WDIR` (wind direction, degrees), `WSPD` (wind speed, m/s), plus the timestamp columns. Values of `MM` mean missing → treat as null and fall through.

**Where it runs:** NDBC sends no CORS headers, so the browser cannot fetch it directly. Fetch in a Next.js route handler (`/api/conditions`) with `revalidate: 1800` (30 min cache). Buoys report ~hourly; anything fresher is wasted requests. Route returns clean JSON:
```ts
{ stationId, waveHeightFt, periodS, windKts, windDir, observedAt, source: "live" | "fallback" | "default" }
```

**Mapping data to the ocean (v1):**
- `waveHeightFt` → wave layer amplitude. Clamp so 1ft doesn't look dead and 20ft doesn't break layout. Amplitude scales linearly from 0.3× at 1ft to 1.6× at 12ft, clamped.
- `periodS` → animation speed. Longer period = slower, rolling motion. 8s period ≈ baseline, scale inversely.
- `windKts` → adds high-frequency chop jitter to the top wave layer above 15kts.

**Total failure mode:** if all three stations fail, render with pleasant defaults (3ft @ 12s, 8kts) and the readout says "STN offline · showing typical conditions." Never a broken page because the government's FTP server hiccuped.

---

## 5. Tech stack (locked)

- Next.js (App Router) + TypeScript, deployed on Vercel
- Tailwind for layout/UI, CSS variables for the palette system
- v1 ocean: layered Canvas 2D waves (**no WebGL/3D in v1**)
- Panel transitions: Framer Motion (`motion` package)
- v2 ocean (later): React Three Fiber + Gerstner shader, swapped behind the same `<Ocean conditions={...}/>` interface — which is why nothing else rearchitects
- Phase 3 RAG (later): route handlers + Supabase pgvector + Voyage embeddings + Claude Haiku
