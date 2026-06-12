import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseNdbc } from "@/lib/ndbc";
import { getConditions } from "@/lib/conditions";

const fixture = (name: string) =>
  readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");

describe("parseNdbc", () => {
  it("parses a normal observation and converts units", () => {
    const c = parseNdbc(fixture("normal.txt"), "46012", "live");
    expect(c).not.toBeNull();
    // 1.4 m -> 4.6 ft
    expect(c!.waveHeightFt).toBe(4.6);
    expect(c!.periodS).toBe(13);
    expect(c!.stationId).toBe("46012");
    expect(c!.source).toBe("live");
    // newest row is 2024-06-11 18:50 UTC
    expect(c!.observedAt).toBe("2024-06-11T18:50:00.000Z");
  });

  it("reads the NEWEST row (top data row), not an older one", () => {
    const c = parseNdbc(fixture("normal.txt"), "46012", "live");
    // older rows have DPD 12; newest has 13
    expect(c!.periodS).toBe(13);
  });

  it("treats MM fields as null", () => {
    const c = parseNdbc(fixture("mm.txt"), "46026", "fallback");
    expect(c).not.toBeNull();
    expect(c!.waveHeightFt).toBeNull();
    expect(c!.periodS).toBeNull();
    // timestamp is still present even when measurements are missing
    expect(c!.observedAt).toBe("2024-06-11T19:50:00.000Z");
  });

  it("keeps wave height when only the period (DPD) is missing", () => {
    const c = parseNdbc(fixture("wvht_no_dpd.txt"), "46012", "live");
    expect(c).not.toBeNull();
    // 1.1 m -> 3.6 ft, present even though DPD is MM
    expect(c!.waveHeightFt).toBe(3.6);
    expect(c!.periodS).toBeNull();
  });

  it("returns null for malformed / non-data content", () => {
    expect(parseNdbc(fixture("malformed.txt"), "46042", "fallback")).toBeNull();
    expect(parseNdbc("", "46012", "live")).toBeNull();
  });
});

describe("getConditions fallback chain", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("falls back to the second station when the primary is dead, then to defaults", async () => {
    const normal = fixture("normal.txt");

    // 46012 (primary) dead -> 46026 (fallback) good.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("46012")) return { ok: false, status: 503 } as Response;
        if (url.includes("46026"))
          return { ok: true, status: 200, text: async () => normal } as Response;
        return { ok: false, status: 503 } as Response;
      }),
    );
    const c1 = await getConditions();
    expect(c1.source).toBe("fallback");
    expect(c1.stationId).toBe("46026");
    expect(c1.waveHeightFt).toBe(4.6);

    // All three stations dead -> pleasant defaults.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 503 }) as Response),
    );
    const c2 = await getConditions();
    expect(c2.source).toBe("default");
    expect(c2.waveHeightFt).toBe(3);
    expect(c2.periodS).toBe(12);
  });

  it("falls through a primary station that is up but reporting MM wave height", async () => {
    const mm = fixture("mm.txt");
    const normal = fixture("normal.txt");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("46012"))
          return { ok: true, status: 200, text: async () => mm } as Response;
        return { ok: true, status: 200, text: async () => normal } as Response;
      }),
    );
    const c = await getConditions();
    expect(c.source).toBe("fallback");
    expect(c.waveHeightFt).toBe(4.6);
  });
});
