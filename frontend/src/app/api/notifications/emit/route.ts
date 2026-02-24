import { NextResponse } from "next/server";
import notificationStore from "@/lib/notification-store";
import type { NotificationType } from "@/types/notifications";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID_TYPES: NotificationType[] = [
  "milestone_approval",
  "contribution_confirmation",
  "project_status",
  "project_update",
  "system",
];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, title, message, link } = body as {
      type?: NotificationType;
      title?: string;
      message?: string;
      link?: string;
    };
    if (!type || !VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { error: "Invalid or missing type" },
        { status: 400 }
      );
    }
    if (!title || typeof title !== "string" || !message || typeof message !== "string") {
      return NextResponse.json(
        { error: "title and message are required strings" },
        { status: 400 }
      );
    }
    const notification = notificationStore.add({
      type,
      title: title.slice(0, 200),
      message: message.slice(0, 1000),
      link: typeof link === "string" ? link : undefined,
    });
    return NextResponse.json(notification);
  } catch (e) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
