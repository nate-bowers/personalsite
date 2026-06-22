import type { Metadata } from "next";
import StationPanel from "@/app/components/StationPanel";
import { getStation } from "@/lib/content";

export const metadata: Metadata = {
  title: "Projects",
  description: "Things built to be real on day one: dailybriefmail, SurfScore, and more. Stack, metrics, links.",
};

export default function ProjectsPage() {
  return <StationPanel content={getStation("projects")} />;
}
