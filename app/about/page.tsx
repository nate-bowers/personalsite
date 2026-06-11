import type { Metadata } from "next";
import StationPanel from "@/app/components/StationPanel";
import { getStation } from "@/lib/content";

export const metadata: Metadata = {
  title: "About",
  description: "Applied math + economics at Vanderbilt, by way of the Bay Area. Builds tools that read live data.",
};

export default function AboutPage() {
  return <StationPanel content={getStation("about")} />;
}
