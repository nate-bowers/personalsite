import { ImageResponse } from "next/og";

export const alt =
  "Nate Bowers — Portfolio: a portfolio that is a live model of the Pacific";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Static OG image of the day-palette sea with the name and the live-data line.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          fontFamily: "serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "45%",
            background: "linear-gradient(to bottom, #4A3D6B, #E8895A)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "55%",
            background: "linear-gradient(to bottom, #2E2A4F, #1E3A52)",
          }}
        />
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            height: "100%",
            padding: 64,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 88, color: "#FBF3E4", lineHeight: 1 }}>Nate Bowers</div>
            <div style={{ fontSize: 30, color: "#FBF3E4", opacity: 0.85, marginTop: 14, fontFamily: "sans-serif" }}>
              applied math + econ · builds with data
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              fontFamily: "monospace",
              fontSize: 26,
              color: "#ffffff",
            }}
          >
            <div style={{ width: 16, height: 16, borderRadius: 16, background: "#FF7847" }} />
            <div>live from NOAA station 46012 · driving this ocean</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
