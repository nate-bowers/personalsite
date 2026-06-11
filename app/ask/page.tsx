import type { Metadata } from "next";
import StationPanel from "@/app/components/StationPanel";
import { getStation } from "@/lib/content";

export const metadata: Metadata = {
  title: "Ask Nate",
  description: "Station 0000 — a retrieval-augmented agent you can ask about my background. Deploying soon.",
};

export default function AskPage() {
  return <StationPanel content={getStation("ask")} />;
}
