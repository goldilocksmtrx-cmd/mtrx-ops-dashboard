import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const filePath = join(process.cwd(), "public", "dashboard-data.json");
    const data = await fs.readFile(filePath, "utf-8");
    const json = JSON.parse(data);
    return NextResponse.json(json);
  } catch (err) {
    console.error("Error reading JSON:", err.message);
    return NextResponse.json({ 
      error: "No data available yet. Run the fetch script first.",
      overview: { activeDeliverables: 0, overdue: 0, formCompliance: 0, activeEditors: 0 },
      podHealth: [],
      delayedPeople: [],
      ai: { active: 0, overdue: 0, statuses: {} },
      forms: [],
      opsTracker: [],
    });
  }
}