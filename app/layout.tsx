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

// Canonical absolute URL for metadata + OG image (link previews). Falls back to
// the live production domain; override with NEXT_PUBLIC_SITE_URL once a custom
// domain is attached.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://personalsite-one-zeta.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Nate Bowers — The Lineup",
    template: "%s · Nate Bowers",
  },
  description:
    "A portfolio that is a live model of the Pacific. The ocean you see is driven by real NOAA buoy data, right now.",
  openGraph: {
    title: "Nate Bowers — The Lineup",
    description:
      "A portfolio that is a live model of the Pacific — the ocean is driven by real NOAA buoy data.",
    url: SITE_URL,
    siteName: "The Lineup",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nate Bowers — The Lineup",
    description: "A portfolio that is a live model of the Pacific.",
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
                  color: "var(--ink)",
                  fontSize: "clamp(2rem, 7vw, 5rem)",
                  textShadow: "0 2px 18px rgba(22,42,62,0.5)",
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
