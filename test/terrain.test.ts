import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../public/terrain/", import.meta.url);
const meta = JSON.parse(readFileSync(fileURLToPath(new URL("meta.json", root)), "utf8"));
const anchorsFile = JSON.parse(
  readFileSync(fileURLToPath(new URL("anchors.json", root)), "utf8"),
);
const { anchors, places } = anchorsFile;
const buf = readFileSync(fileURLToPath(new URL("heightmap.bin", root)));
const height = new Int16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2);

const { width: W, height: H, bbox } = meta;

// elevation at a real-world coordinate
const at = (lng: number, lat: number) => {
  const x = Math.round(((lng - bbox.lngMin) / (bbox.lngMax - bbox.lngMin)) * (W - 1));
  const y = Math.round(((bbox.latMax - lat) / (bbox.latMax - bbox.latMin)) * (H - 1));
  return height[y * W + x];
};

describe("terrain heightmap (Stinson -> Big Sur)", () => {
  it("has the expected dimensions and int16 encoding", () => {
    expect(W).toBe(640);
    expect(H).toBe(896);
    expect(meta.encoding).toBe("int16");
    expect(height.length).toBe(W * H);
  });

  it("covers the spec bounding box (38.05N..36.1N)", () => {
    expect(bbox.latMax).toBeGreaterThanOrEqual(38.0);
    expect(bbox.latMin).toBeLessThanOrEqual(36.25);
    expect(bbox.lngMin).toBeLessThanOrEqual(-122.9);
  });

  it("Mt Tamalpais and the Santa Lucias tower over the coastal shelf", () => {
    const mtTam = at(-122.596, 37.924);
    const santaLucia = at(-121.62, 36.25); // ridge crest above the Big Sur coast
    const shelf = at(-123.0, 37.3); // open Pacific
    expect(mtTam).toBeGreaterThan(350);
    expect(santaLucia).toBeGreaterThan(800);
    expect(shelf).toBeLessThan(-50);
  });

  it("the bay exists: water inside the Golden Gate, carved from real data", () => {
    expect(at(-122.478, 37.82)).toBeLessThan(0); // the strait itself
    expect(at(-122.3, 37.7)).toBeLessThan(0); // central SF Bay
    expect(at(-122.2, 37.55)).toBeLessThan(2); // toward the South Bay
    expect(at(-122.44, 37.77)).toBeGreaterThan(0); // San Francisco is land
    expect(at(-122.55, 37.85)).toBeGreaterThan(0); // Marin headlands are land
  });

  it("Monterey Bay's curve is water", () => {
    expect(at(-121.9, 36.8)).toBeLessThan(0);
    expect(at(-121.85, 36.7)).toBeLessThan(0);
  });
});

describe("terrain anchors (spec spot map)", () => {
  it("has all five sections at the spec spots, spread across the scene", () => {
    const slugs = anchors.map((a: { slug: string }) => a.slug).sort();
    expect(slugs).toEqual(["about", "ask", "contact", "projects", "resume"]);
    for (const a of anchors) {
      expect(Math.abs(a.x)).toBeLessThanOrEqual(meta.sceneWidth / 2 + 0.001);
      expect(Math.abs(a.z)).toBeLessThanOrEqual(meta.sceneDepth / 2 + 0.001);
    }
    // spread: Stinson is far north, Big Sur far south — not a cluster
    const about = anchors.find((a: { slug: string }) => a.slug === "about");
    const contact = anchors.find((a: { slug: string }) => a.slug === "contact");
    expect(contact.z - about.z).toBeGreaterThan(10);
  });

  it("every buoy floats: all anchors in negative-elevation cells", () => {
    for (const a of anchors) {
      expect(a.elevMeters, `${a.place} should be in the water`).toBeLessThan(-5);
    }
  });

  it("Ask Nate is the real offshore Station 46012", () => {
    const ask = anchors.find((a: { slug: string }) => a.slug === "ask");
    expect(ask.place).toContain("46012");
    expect(ask.lat).toBeCloseTo(37.36, 1);
    expect(ask.elevMeters).toBeLessThan(-50);
  });

  it("carries the four terrain place names", () => {
    const names = places.map((p: { name: string }) => p.name).sort();
    expect(names).toEqual(["BIG SUR", "MAVERICKS", "SANTA CRUZ", "STINSON"]);
  });
});
