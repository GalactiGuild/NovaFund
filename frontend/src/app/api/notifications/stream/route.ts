import notificationStore from "@/lib/notification-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** SSE stream: sends initial history then pushes new notifications in real time */
export async function GET() {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      unsubscribe = notificationStore.subscribe(controller);
      const history = notificationStore.getHistory();
      history.forEach((n) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(n)}\n\n`));
      });
    },
    cancel() {
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Connection: "keep-alive",
    },
  });
}
