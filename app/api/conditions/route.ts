import { NextResponse } from "next/server";
import { getConditions } from "@/lib/conditions";

// Cache for 30 minutes; buoys report roughly hourly. See DESIGN.md §4.
export const revalidate = 1800;

export async function GET() {
  const conditions = await getConditions();
  return NextResponse.json(conditions, {
    headers: {
      "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
    },
  });
}
