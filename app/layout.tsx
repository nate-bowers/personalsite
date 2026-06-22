import type { Metadata } from "next";
import { Instrument_Serif, Schibsted_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import RendererStage from "./components/RendererStage";
import Readout from "./components/Readout";
import BuoyField from "./components/BuoyField";
import KeyboardNav from "./components/KeyboardNav";
import IndexNav from "./components/IndexNav";
import FirstVisitHint from "./components/FirstVisitHint";
import { getConditions } from "@/lib/conditions";

const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});
const body = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

// Canonical absolute URL for metadata + OG image (link previews). Defaults to the
// live custom domain; NEXT_PUBLIC_SITE_URL (set in the Vercel project) overrides.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://natebowers.dev";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Nate Bowers · Portfolio",
    template: "%s · Nate Bowers",
  },
  description:
    "A live 3D model of the Northern California coast. The ocean is driven by a real NOAA buoy, right now. Built by Nate Bowers.",
  openGraph: {
    title: "Nate Bowers · Portfolio",
    description:
      "A live 3D model of the Northern California coast, with the ocean driven by a real NOAA buoy right now.",
    url: SITE_URL,
    siteName: "Nate Bowers",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nate Bowers · Portfolio",
    description:
      "A live 3D model of the Northern California coast, driven by a real NOAA buoy right now.",
  },
};

// Swap the js/no-js flag before first paint (drives the no-JS content fallback).
const INIT = `(function(){try{document.documentElement.classList.remove("no-js");document.documentElement.classList.add("js");}catch(e){}})();`;

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const conditions = await getConditions();

  return (
    <html
      lang="en"
      className={`no-js ${display.variable} ${body.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh overflow-hidden font-body" suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: INIT }} />
        <RendererStage conditions={conditions}>
          <KeyboardNav />
          <BuoyField />

          {/* Persistent header: name top-left, instrument readout top-right. */}
          <header className="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-4 sm:gap-4 sm:p-7">
            <div className="min-w-0">
              <h1
                className="font-display leading-none"
                style={{
                  // Deliberate one-off: BLACK (not --ink) for contrast against the bright golden sky.
                  color: "#000000",
                  fontSize: "clamp(2rem, 7vw, 5rem)",
                  textShadow: "0 2px 18px rgba(255,217,160,0.55)",
                }}
              >
                Nate Bowers
              </h1>
              <FirstVisitHint />
            </div>
            <div className="max-w-[58%] text-right sm:max-w-none sm:shrink-0">
              <Readout conditions={conditions} />
            </div>
          </header>

          <IndexNav />

          {/* Section routes render their station panel here as a fixed overlay. */}
          {children}
        </RendererStage>
      </body>
    </html>
  );
}
