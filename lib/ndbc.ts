/**
 * NOAA NDBC realtime feed types + pure parser.
 * Feed: https://www.ndbc.noaa.gov/data/realtime2/{STATION}.txt
 * See DESIGN.md §4. The parser is pure and unit-tested (test/ndbc.test.ts).
 */

export type ConditionsSource = "live" | "fallback" | "default";

export interface Conditions {
  stationId: string;
  /** Significant wave height, feet (WVHT, converted from metres). */
  waveHeightFt: number | null;
  /** Dominant wave period, seconds (DPD). */
  periodS: number | null;
  /** ISO-8601 observation time, or null if unparseable. */
  observedAt: string | null;
  source: ConditionsSource;
}

/** Pleasant defaults used when every station fails. See DESIGN.md §4 "Total failure mode". */
export const DEFAULT_CONDITIONS: Conditions = {
  stationId: "—",
  waveHeightFt: 3,
  periodS: 12,
  observedAt: null,
  source: "default",
};

const METRES_TO_FEET = 3.28084;

/** A field is missing when it is absent or NDBC's "MM" sentinel. */
function num(value: string | undefined): number | null {
  if (value === undefined) return null;
  if (value === "MM" || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function round(n: number | null, digits = 1): number | null {
  if (n === null) return null;
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/**
 * Parse the most recent observation row from a raw NDBC realtime2 text file.
 * The file has two header lines (names, units) then rows newest-first.
 * Columns: #YY MM DD hh mm WDIR WSPD GST WVHT DPD APD MWD PRES ATMP WTMP ...
 *
 * Returns null only if there is no usable data row at all; otherwise returns a
 * Conditions object whose individual fields may be null (MM gaps).
 */
export function parseNdbc(raw: string, stationId: string, source: ConditionsSource = "live"): Conditions | null {
  const lines = raw.split(/\r?\n/).map((l) => l.trim());

  // Locate the header so we can index columns by name rather than position.
  const headerLine = lines.find((l) => l.startsWith("#") && /\bWVHT\b/.test(l));
  if (!headerLine) return null;
  const cols = headerLine.replace(/^#/, "").trim().split(/\s+/);
  const idx = (name: string) => cols.indexOf(name);

  const iWVHT = idx("WVHT");
  const iDPD = idx("DPD");
  const iYY = idx("YY") === -1 ? idx("#YY") : idx("YY");
  const iMM = idx("MM"); // first MM after YY is the month
  const iDD = idx("DD");
  const ihh = idx("hh");
  const imm = idx("mm");

  // First non-comment, non-empty line after the headers is the newest observation.
  const headerIndex = lines.indexOf(headerLine);
  const dataLine = lines
    .slice(headerIndex + 1)
    .find((l) => l.length > 0 && !l.startsWith("#"));
  if (!dataLine) return null;

  const f = dataLine.split(/\s+/);

  const waveM = num(f[iWVHT]);
  const period = num(f[iDPD]);

  let observedAt: string | null = null;
  const yy = num(f[iYY]);
  const mo = num(f[iMM]);
  const dd = num(f[iDD]);
  const hh = num(f[ihh]);
  const mi = num(f[imm]);
  if (yy !== null && mo !== null && dd !== null && hh !== null && mi !== null) {
    const year = yy < 100 ? 2000 + yy : yy;
    // NDBC timestamps are UTC.
    const d = new Date(Date.UTC(year, mo - 1, dd, hh, mi));
    if (!Number.isNaN(d.getTime())) observedAt = d.toISOString();
  }

  return {
    stationId,
    waveHeightFt: round(waveM === null ? null : waveM * METRES_TO_FEET),
    periodS: round(period),
    observedAt,
    source,
  };
}

