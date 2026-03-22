import { getRunner } from "@/lib/engine/singleton";

export const dynamic = "force-dynamic";

export async function GET() {
  const runner = getRunner();
  const encoder = new TextEncoder();
  let cancelled = false;
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Send keepalive
      controller.enqueue(encoder.encode(": connected\n\n"));

      unsubscribe = runner.subscribe((events) => {
        if (cancelled) return;
        const data = JSON.stringify(events);
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      });
    },
    cancel() {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
