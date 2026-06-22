import type { Metadata } from "next";
import StationPanel from "@/app/components/StationPanel";
import { getStation } from "@/lib/content";

export const metadata: Metadata = {
  title: "Contact",
  description: "Channel open: email, GitHub, LinkedIn. Easiest is email; I read everything and reply to most.",
};

export default function ContactPage() {
  return <StationPanel content={getStation("contact")} />;
}
