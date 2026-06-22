import { ImageResponse } from "next/og";

// Apple touch icon (iOS home-screen). Next.js auto-wires the <link> for this
// route. A buoy glyph on the dark ground, in locked buoy-orange (#FF7847) — the
// same read as app/icon.svg but rendered as a PNG (iOS doesn't take SVG here).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0e1622",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          {/* float */}
          <div style={{ width: 40, height: 40, borderRadius: 40, background: "#FF7847" }} />
          {/* mast */}
          <div style={{ width: 8, height: 22, background: "#FF7847" }} />
          {/* body, with a dark band */}
          <div
            style={{
              width: 92,
              height: 60,
              background: "#FF7847",
              borderRadius: "10px 10px 34px 34px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ width: 64, height: 12, borderRadius: 6, background: "#0e1622", opacity: 0.6 }} />
          </div>
        </div>
      </div>
    ),
    size,
  );
}
