# The Coast — Phase 2 Spec v1.0

Successor to the v1 2D ocean. The site becomes a stylized 3D rendering of the real Northern California coastline, Stinson Beach to Big Sur, compressed into one scene. Camera floats offshore at altitude during permanent golden hour. Sections are NOAA-style buoys anchored at real surf spots. Clicking a buoy flies the camera to it and surfaces the station panel.

Everything from v1 that survives untouched: the NOAA data pipeline, the routes, the station panels and their content, the index nav, the readout, the fonts, the clarity rules. Phase 2 replaces the stage, not the show.

---

## 1. Art direction

**Reference: the Firewatch poster look.** Stylized-realistic terrain, layered atmospheric depth, painterly gradient lighting. Not low-poly-flat-shaded (too 2016), not photoreal (impossible solo, and worse for brand). Landforms are real, materials are simplified, atmosphere does the heavy lifting.

**Lighting: lock golden hour.** v1's four time-of-day palettes get retired for Phase 2. One art direction executed beautifully beats four executed adequately, and you asked for sunset. Sun low in the west over the water, warm rim light on the ridgelines, long glitter path on the ocean. Night mode returns in the backlog as the only variant (it's the second-best look and the blinking buoys earn it).

**Palette (golden hour, locked):**
- `--sky-zenith: #4A3D6B` deep violet overhead
- `--sky-low: #E8895A` orange band at the horizon
- `--sun-glow: #FFD9A0`
- `--water-far: #2E2A4F` violet sea at distance
- `--water-near: #1E3A52` deeper blue close to camera
- `--glitter: #FFB870` sun path on water
- `--land-lit: #C97B4A` sunlit terrain faces
- `--land-shade: #3D3357` shadowed faces
- `--fog: #D9A084` atmospheric haze between terrain layers
- `--ink: #FBF3E4`, `--accent: #FF7847` (buoy orange survives)

**The realism trick is atmosphere, not geometry.** Exponential fog tinted `--fog` between camera and far terrain, 3 to 4 visible ridgeline layers fading into haze, subtle bloom on the sun glitter. This is what makes simplified geometry read as a place instead of a tech demo.

---

## 2. The geography

Real coastline, compressed. Roughly 180 miles becomes one continuous scene maybe 8 to 10 "scene kilometers" long, coast running diagonally from upper-left (north) to lower-right (south) when viewed from the default camera offshore.

**Terrain is generated from real elevation data.** Use the AWS Open Data terrain tiles (Terrarium-encoded heightmaps, free, no API key) covering roughly 38.0°N to 36.2°N along the coast. Downsample aggressively, exaggerate vertical scale ~2x so Mt Tam and the Santa Lucias read at a glance, and apply the compression along the coast-parallel axis. The site copy gets a line out of this: "terrain rendered from USGS elevation data."

**Spot map (section → real place):**

| Section | Spot | Why |
|---|---|---|
| About | Stinson Beach | northern start of the coast, where the story begins |
| Projects | Mavericks, Half Moon Bay | the heavy-water spot gets the heavy work |
| Ask Nate | Station 46012, offshore HMB | the RAG buoy IS the real data buoy driving the site. Best gag on the site |
| Resume | Steamer Lane, Santa Cruz | the consistent, dependable point break |
| Contact | Big Sur | end of the road |

Each buoy gets a small mono label as before (always visible, clarity rules apply). Faint place names sit on the terrain in mono (STINSON · MAVERICKS · SANTA CRUZ · BIG SUR) so the geography is legible to non-surfers.

---

## 3. Camera design

**Default shot:** offshore, elevated maybe 30 to 40 degrees above horizontal, looking northeast at the coastline so terrain, water, and sky all share the frame. Slow ambient drift (a few meters of lazy float) so the scene breathes. No free-look in v2a; the camera is on rails, full stop. Free orbit is how 3D portfolios become unusable.

**Buoy click:** camera flies a smooth curve down toward the buoy over ~1.8s (ease-in-out, GSAP or lerped spring), settling into a low shot with the buoy in the lower third bobbing on the water and the coast behind it. Panel slides up over the right 40% of the frame (desktop) instead of the bottom 75% so the scene stays visible. Close = camera flies home.

**Clarity rules carry over hard:** all five buoys visible from the default shot, labels always on, one click verb, the index nav remains and now also triggers the camera moves. Browser back closes panel and returns camera.

**Reduced motion / weak devices (revised — the v1 2D ocean is retired):** one scene, three fidelity tiers. Full 3D on WebGL2 desktops; degraded-live 3D ("calm" quality — fewer trees/segments, no bloom, low DPR) on phones and narrow viewports; and a **static still image of the same coast** (`StaticCoast`, with DOM buoys) for no-WebGL2 **or** prefers-reduced-motion, plus as the safety-net when the scene fails to present within ~8s. Non-negotiable: every visitor sees the coast — recruiters on locked-down laptops get it as an image, never a different ocean.

---

## 4. The water and the buoys

**Water:** Gerstner wave displacement on a plane, amplitude/period/chop driven by the same `/api/conditions` endpoint and mapping rules from the v1 spec. Stylized shading: two-tone water with the sun glitter path (specular stretched along sun direction), foam noise only near shorelines. No screen-space reflections, no realism arms race.

**Buoys:** modeled on the real NOAA 3-meter discus buoy: flat disc hull in weathered orange-red, lattice mast, small solar panel and instrument cluster on top. Distinctive silhouette, maybe 300 to 600 triangles each, built in code (R3F primitives) or one small GLB. They heave, pitch, and roll with the local wave function so they sit IN the water, not on it. That coupling between sim and prop is what reads as "realistic."

**Scale honesty:** buoys render larger than life relative to the terrain (true scale would be invisible pixels). Same compression license as the geography.

---

## 5. Stack additions

- `three`, `@react-three/fiber`, `@react-three/drei` (existing plan)
- `@react-three/postprocessing` for fog/bloom/color grading
- GSAP (or drei's camera controls + custom lerp) for camera rails
- A small offline script (Node) that downloads terrain tiles for the bounding box, decodes Terrarium PNG to a heightfield, compresses/downsamples, and writes a single binary heightmap asset checked into the repo. Terrain generation runs at build time, never at runtime.
- Draco/meshopt compression if any GLB assets enter

Performance budget: under 150k triangles in frame, one drawcall-heavy enemy (terrain) merged into few meshes, target 60fps on an M-series laptop and 30fps on a mid phone, lazy-load the entire 3D bundle behind the landing frame so first paint stays instant.

---

## 6. Build phases

### Phase 2a — The scene (2 weekends)
Terrain pipeline script, heightmap rendered with golden-hour material and fog layers, Gerstner water plane driven by live conditions, sun + glitter, default camera shot with ambient drift. No interaction yet beyond the existing index nav opening panels the v1 way. DoD: a screenshot of the default shot looks like a poster you'd hang up.

### Phase 2b — The flight (1 to 2 weekends)
Five buoy models placed at spots, wave-coupled bobbing, click targets with labels, camera rail system, panel redesign to the 40% side sheet, fallback renderer switch (2D ocean for reduced-motion/weak devices/mobile). DoD: full click-fly-read-close loop on all five buoys, back button correct, fallback verified by forcing it.

### Phase 2c — The polish (1 weekend)
Place-name labels on terrain, sun glitter tuning, bloom pass, loading sequence (conditions readout types in while the scene streams), new OG image from the actual scene, performance pass with real device testing. DoD: Lighthouse performance 85+ desktop, the QA checklist from v1 rerun in full.

Phase 3 (RAG goes live at Station 46012) is unchanged and now has a better home.

Honest scope statement: this is 4 to 6 weekends of real work even with Claude Code doing the heavy lifting, because the iteration loop is visual. Install the webapp-testing skill before starting so sessions can screenshot their own output; without it you become the render farm's eyeballs and everything takes 3x longer.

---

## 7. Claude Code prompts

Add this file to the repo as DESIGN-PHASE2.md first. Update the lineup-design-system skill with the new palette and the "golden hour locked" rule before prompt 6 runs.

### Prompt 6 — Terrain pipeline

```
Goal: build-time terrain generation from real elevation data.

Context: read DESIGN-PHASE2.md sections 2 and 5. This produces the heightmap asset only, no rendering yet.

Tasks:
1. Write scripts/build-terrain.mjs: download Terrarium terrain tiles from the AWS Open Data elevation tiles (s3://elevation-tiles-prod via https, zoom ~10-11) for the bounding box covering the California coast from Stinson Beach (37.90N) to Big Sur (36.25N), decode RGB to elevation, stitch into one heightfield.
2. Apply the compression transform from DESIGN-PHASE2.md: downsample to a grid around 1024 x 512, compress the along-coast axis so the full run fits the scene, exaggerate vertical 2x, clamp ocean depth to a shallow negative shelf.
3. Write the result as a binary Float32 heightmap + JSON metadata (dimensions, bounds, the lat/lng-to-scene-coordinate transform) into /public/terrain/.
4. Also emit scene coordinates for these five anchor points using the transform: Stinson Beach 37.900,-122.644; Mavericks 37.495,-122.499; Station 46012 37.36,-122.88; Steamer Lane 36.951,-122.026; Big Sur 36.270,-121.807. Write to /public/terrain/anchors.json.
5. The script runs via npm run build:terrain, is idempotent, caches downloaded tiles in a gitignored folder, and the output assets ARE committed.

Done when: the script runs clean, output heightmap loads in a test that asserts Mt Tamalpais and the Santa Lucia range are visibly higher than the coastal shelf, and anchors.json contains five plausible scene coordinates (ocean anchors must land in negative-elevation cells).
```

### Prompt 7 — The golden hour scene

```
Goal: replace the 2D ocean with the 3D coast scene, non-interactive.

Context: read DESIGN-PHASE2.md sections 1, 3, 4, 5. Terrain assets exist in /public/terrain. The v1 2D <Ocean> component must remain functional, selected by the fallback logic in task 6.

Tasks:
1. Add three, @react-three/fiber, drei, @react-three/postprocessing. The entire 3D scene is one lazy-loaded client component; landing text, readout, and index nav render before it streams in.
2. Terrain mesh from the heightmap, custom shader material: faces lit by a low western sun using land-lit/land-shade palette tokens, exponential height fog in --fog color, far ridgelines fading into haze per the art direction.
3. Water: a Gerstner-displaced plane using the same conditions-to-amplitude/speed/chop mapping as the v1 ocean (read it from the existing Ocean component and keep the constants identical). Two-tone water colors from tokens plus an elongated sun-glitter specular path toward the western sun.
4. Sky: gradient dome from sky-zenith to sky-low with a sun disc and soft glow, bloom pass tuned subtle (the glitter should glow, the UI must not).
5. Default camera per DESIGN-PHASE2.md section 3: offshore, elevated, coast diagonal in frame, slow ambient drift. No user camera control of any kind.
6. Renderer selection (revised): the live 3D scene whenever WebGL2 is available — "calm" quality on viewports < 768px. No WebGL2 OR prefers-reduced-motion → the static coast image (StaticCoast). RendererStage owns this decision; the v1 2D Ocean is retired.
7. Use the webapp-testing skill: screenshot the default shot at 1440px and 768px, compare against the art direction, iterate until the fog layering and glitter path match the spec, and include the final screenshots in your report.

Done when: the default shot reads as golden-hour NorCal coast (your screenshots prove it), live conditions visibly drive the water, 60fps on desktop, fallback path verified by forcing each condition, first paint not regressed.
```

### Prompt 8 — Buoys and camera flight

```
Goal: interaction. Five buoys at real anchors, camera rails, side-sheet panels.

Context: read DESIGN-PHASE2.md sections 2, 3, 4. Anchors in /public/terrain/anchors.json. Clarity rules from DESIGN.md still govern.

Tasks:
1. Buoy model: NOAA 3m discus buoy silhouette built from R3F primitives per the spec (disc hull, lattice mast, instrument top), accent orange, under 600 tris. One reusable component.
2. Place five at the anchor coordinates. Each samples the local Gerstner function each frame for heave/pitch/roll so it moves with the actual water. Always-visible mono labels billboard toward camera, plus faint place-name labels on the terrain (STINSON, MAVERICKS, SANTA CRUZ, BIG SUR).
3. Click/tap targets generous (raycast against an invisible larger sphere). Hover: buoy label brightens, cursor pointer. Keyboard: buoys reachable in DOM order with visible focus, Enter activates.
4. Camera rail: on activation, fly a smooth eased curve (~1.8s) to a low shot with the buoy lower-third and coast behind, per section 3. Close flies home. Interrupting mid-flight (clicking another buoy or back) retargets cleanly instead of snapping.
5. Panels become a right-side sheet at 40% width on desktop over the live scene; mobile and 2D-fallback keep the v1 bottom-sheet behavior. All existing panel content, routes, deep links, Esc, and back-button behavior must keep working in both renderers.
6. Index nav now triggers the same camera flights in 3D mode.
7. webapp-testing pass: record the full loop (land, click Mavericks, read panel, close, click Big Sur) and screenshot each state at two breakpoints.

Done when: all five fly-and-read loops work via mouse, keyboard, index nav, and deep link; back button is correct mid-flight; the 2D fallback still passes the v1 QA checklist; screenshots included.
```

Prompt 9 (polish, loading sequence, OG image, perf) gets written after 2b ships and you've seen what actually needs polishing.

---

## 8. Decisions you should ratify before Prompt 6

1. Golden hour locked, time-of-day system retired (night mode to backlog). Confirm you're good losing the morning look.
2. Ask Nate moves offshore to the real Station 46012. Best joke on the site, but it breaks the one-spot-per-section symmetry. Confirm.
3. Mobile gets the 2D version in Phase 2a/2b, 3D mobile is a 2c stretch goal. Confirm.
4. Panel becomes a 40% side sheet in 3D mode. Confirm.
