/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";
export const alt =
  "Nate Bowers's portfolio: a live 3D model of the Northern California coast, driven by NOAA buoy data";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// OG card: a still of the actual coast scene (the static-tier render) with the
// name and the live-NOAA line over it. No tagline.
export default async function OpengraphImage() {
  const photo = await readFile(join(process.cwd(), "public", "coast-fallback.jpg"));
  const src = `data:image/jpeg;base64,${photo.toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative" }}>
        <img
          src={src}
          width={1200}
          height={630}
          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
        {/* legibility scrim: darken the top and bottom so the text reads over the photo */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            background:
              "linear-gradient(to bottom, rgba(20,17,30,0.5) 0%, rgba(20,17,30,0) 30%, rgba(20,17,30,0) 60%, rgba(20,17,30,0.66) 100%)",
          }}
        />
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            height: "100%",
            width: "100%",
            padding: 64,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 92,
              color: "#FBF3E4",
              lineHeight: 1,
              fontFamily: "serif",
              textShadow: "0 2px 22px rgba(0,0,0,0.55)",
            }}
          >
            Nate Bowers
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              fontFamily: "monospace",
              fontSize: 26,
              color: "#ffffff",
              textShadow: "0 1px 10px rgba(0,0,0,0.6)",
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
