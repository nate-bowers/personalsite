import type { Metadata } from "next";
import StationPanel from "@/app/components/StationPanel";
import { getStation } from "@/lib/content";

export const metadata: Metadata = {
  title: "Resume",
  description: "The logbook — embedded PDF, a download, and the key facts a recruiter can skim in five seconds.",
};

export default function ResumePage() {
  return <StationPanel content={getStation("resume")} />;
}
