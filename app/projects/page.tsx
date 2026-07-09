import type { Metadata } from "next";
import StationPanel from "@/app/components/StationPanel";
import { getStation } from "@/lib/content";

export const metadata: Metadata = {
  title: "Projects",
  description: "Things built to be real on day one: Data Investigator Agent, Huberman GPT, dailybriefmail, and SurfScore. Stack, metrics, links.",
};

export default function ProjectsPage() {
  return <StationPanel content={getStation("projects")} />;
}
