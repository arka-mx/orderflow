import { getGlobalSimulator } from '@/lib/engine/simulator';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const simulator = getGlobalSimulator();

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const sendEvent = (eventType: string, data: any) => {
        try {
          const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          // Controller might be closed
        }
      };

      // Subscribe to simulator events
      const unsubscribe = simulator.subscribe({
        onSnapshot: (snapshot) => sendEvent('snapshot', snapshot),
        onMetrics: (metrics) => sendEvent('metrics', metrics),
        onTrade: (trade) => sendEvent('trade', trade),
      });

      // Send initial snapshot and metrics immediately
      sendEvent('snapshot', simulator.getSnapshot());
      sendEvent('metrics', simulator.getMetrics());

      // Teardown when client disconnects
      req.signal.addEventListener('abort', () => {
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
