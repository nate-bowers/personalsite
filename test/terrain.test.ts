import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../public/terrain/", import.meta.url);
const meta = JSON.parse(readFileSync(fileURLToPath(new URL("meta.json", root)), "utf8"));
const anchors = JSON.parse(readFileSync(fileURLToPath(new URL("anchors.json", root)), "utf8"));
const buf = readFileSync(fileURLToPath(new URL("heightmap.bin", root)));
const height = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);

const { width: W, height: H } = meta;
const at = (x: number, y: number) => height[y * W + x];

describe("terrain heightmap", () => {
  it("has the expected dimensions", () => {
    expect(W).toBe(1024);
    expect(H).toBe(896);
    expect(height.length).toBe(W * H);
  });

  it("contains real peaks and an ocean shelf", () => {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < height.length; i++) {
      const v = height[i];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    expect(max).toBeGreaterThan(1000); // Mt Tam / Santa Lucia ranges
    expect(min).toBeLessThanOrEqual(0); // ocean present
  });

  it("has the inland ranges visibly higher than the coastal shelf", () => {
    // Eastern (inland) half should tower over the western (offshore) quarter.
    let maxInland = -Infinity;
    let maxOffshore = -Infinity;
    for (let y = 0; y < H; y++) {
      for (let x = Math.floor(W / 2); x < W; x++) maxInland = Math.max(maxInland, at(x, y));
      for (let x = 0; x < Math.floor(W / 4); x++) maxOffshore = Math.max(maxOffshore, at(x, y));
    }
    expect(maxInland).toBeGreaterThan(maxOffshore + 300);
    expect(maxInland).toBeGreaterThan(800);
  });
});

describe("terrain anchors", () => {
  it("has all five sections within scene bounds", () => {
    const slugs = anchors.map((a: { slug: string }) => a.slug).sort();
    expect(slugs).toEqual(["about", "ask", "contact", "projects", "resume"]);
    for (const a of anchors) {
      expect(Math.abs(a.x)).toBeLessThanOrEqual(meta.sceneWidth / 2 + 0.001);
      expect(Math.abs(a.z)).toBeLessThanOrEqual(meta.sceneDepth / 2 + 0.001);
      expect(Number.isFinite(a.elevMeters)).toBe(true);
    }
  });

  it("places the offshore RAG buoy (Station 46012) in a negative-elevation cell", () => {
    const ask = anchors.find((a: { slug: string }) => a.slug === "ask");
    expect(ask).toBeTruthy();
    expect(ask.place).toContain("46012");
    expect(ask.elevMeters).toBeLessThan(0);
  });
});
