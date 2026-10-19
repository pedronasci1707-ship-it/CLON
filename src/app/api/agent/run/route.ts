import { apiHeaders, enforceRateLimit, enforceSameOrigin, jsonError, readJson, requestId } from "@/server/http";
import { runRequestSchema } from "@/server/schemas";
import { runAgent } from "@/server/agent/engine";
import type { RunEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    enforceSameOrigin(request);
    enforceRateLimit(request, "agent-run");
    const parsed = runRequestSchema.parse(await readJson(request));
    const encoder = new TextEncoder();
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const emit = (event: RunEvent) => {
          if (cancelled || request.signal.aborted) return;
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        };
        try {
          await runAgent(parsed, emit, request.signal);
        } finally {
          if (!cancelled) controller.close();
        }
      },
      cancel() {
        cancelled = true;
      },
    });
    return new Response(stream, {
      status: 200,
      headers: apiHeaders(id, {
        "content-type": "application/x-ndjson; charset=utf-8",
        "x-accel-buffering": "no",
      }),
    });
  } catch (error) {
    return jsonError(error, id, "/api/agent/run");
  }
}
