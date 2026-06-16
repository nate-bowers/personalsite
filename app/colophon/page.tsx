import type { Metadata } from "next";
import Colophon from "@/app/components/Colophon";

export const metadata: Metadata = {
  title: "Colophon",
  description:
    "How the coast is built: a live 3D model of the Northern California coast from real USGS elevation and NOAA buoy data — plus the easter eggs hidden in the water.",
};

export default function ColophonPage() {
  return <Colophon />;
}
