type CandyRealtimeEvent = {
  candyId: string;
  userId: string;
  status: "Wrapped";
  createdAt: string;
};

const encoder = new TextEncoder();
const globalForRealtime = globalThis as typeof globalThis & {
  __echoCandyEventControllers?: Set<ReadableStreamDefaultController<Uint8Array>>;
};

const controllers = globalForRealtime.__echoCandyEventControllers ?? new Set<ReadableStreamDefaultController<Uint8Array>>();

globalForRealtime.__echoCandyEventControllers = controllers;

function encodeServerSentEvent(event: string, data: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export function createCandyEventStream() {
  let interval: ReturnType<typeof setInterval> | null = null;
  let currentController: ReadableStreamDefaultController<Uint8Array> | null = null;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      currentController = controller;
      controllers.add(controller);
      controller.enqueue(encoder.encode(": echo connected\n\n"));
      interval = setInterval(() => {
        controller.enqueue(encoder.encode(": heartbeat\n\n"));
      }, 25000);
    },
    cancel() {
      if (currentController) {
        controllers.delete(currentController);
      }

      if (interval) {
        clearInterval(interval);
      }
    },
  });
}

export function broadcastCandyEvent(event: CandyRealtimeEvent) {
  const payload = encodeServerSentEvent("candy.wrapped", event);

  controllers.forEach((controller) => {
    try {
      controller.enqueue(payload);
    } catch {
      controllers.delete(controller);
    }
  });

  return {
    clients: controllers.size,
  };
}
