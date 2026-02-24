import { NextRequest, NextResponse } from "next/server";
import notificationStore from "@/lib/notification-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET ?limit=50 - for offline catch-up and initial load */
export async function GET(request: NextRequest) {
  const limit = Math.min(
    100,
    Math.max(1, parseInt(request.nextUrl.searchParams.get("limit") ?? "50", 10))
  );
  const history = notificationStore.getHistory(limit);
  return NextResponse.json(history);
}
