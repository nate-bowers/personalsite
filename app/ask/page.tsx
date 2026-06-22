import type { Metadata } from "next";
import StationPanel from "@/app/components/StationPanel";
import { getStation } from "@/lib/content";

export const metadata: Metadata = {
  title: "Ask Nate",
  description: "Station 0000 — a retrieval-augmented agent you can ask about my background. Deploying soon.",
};

// Intentionally live-but-hidden: the Ask buoy + nav are gated off by
// lib/visibility.ts (SHOW_ASK=false), but this route stays renderable as
// Phase-3 deep-link prep. robots.ts disallows /ask while it's unbuilt.
export default function AskPage() {
  return <StationPanel content={getStation("ask")} />;
}
