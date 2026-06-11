import { parseNdbc, DEFAULT_CONDITIONS, type Conditions, type ConditionsSource } from "./ndbc";

/** Primary then fallbacks. See DESIGN.md §4. */
export const STATIONS = ["46012", "46026", "46042"] as const;

const FEED = (id: string) => `https://www.ndbc.noaa.gov/data/realtime2/${id}.txt`;

/** Don't let a hung government FTP server hang the page. */
const FETCH_TIMEOUT_MS = 4000;

async function fetchStation(id: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(FEED(id), {
      signal: controller.signal,
      // Buoys report ~hourly; 30 min cache. See DESIGN.md §4.
      next: { revalidate: 1800 },
      headers: { "User-Agent": "the-lineup/1.0 (personal portfolio)" },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Walk the station fallback chain and return the first station reporting a real
 * wave height. If every station fails, return pleasant defaults (source: "default").
 * This function never throws and never returns null — the page always has an ocean.
 */
export async function getConditions(): Promise<Conditions> {
  for (let i = 0; i < STATIONS.length; i++) {
    const id = STATIONS[i];
    const source: ConditionsSource = i === 0 ? "live" : "fallback";
    const raw = await fetchStation(id);
    if (!raw) continue;
    const parsed = parseNdbc(raw, id, source);
    // A station that's up but reporting MM for wave height is no use to the ocean.
    if (parsed && parsed.waveHeightFt !== null) return parsed;
  }
  return DEFAULT_CONDITIONS;
}
