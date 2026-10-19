import "server-only";

import Parallel from "parallel-web";
import { z } from "zod";
import type { EventOption } from "@/lib/types";
import { serverConfig } from "../config";
import { AppError } from "../errors";

const eventSchema = z.object({
  title: z.string().min(1).max(300),
  url: z.string().url().max(2_000).optional().nullable(),
  when: z.string().max(300).optional().nullable(),
  start_iso: z.string().datetime({ offset: true }).optional().nullable(),
  venue: z.string().max(300).optional().nullable(),
  summary: z.string().min(1).max(2_000),
  evidence: z.string().max(1_000).optional().nullable(),
  date_verified: z.boolean(),
});

const outputSchema = z.object({ events: z.array(eventSchema).max(12) });

let client: Parallel | undefined;

function parallelClient() {
  const config = serverConfig();
  if (!config.parallel.apiKey) {
    throw new AppError("PARALLEL_NOT_CONFIGURED", 503, "Live event discovery requires PARALLEL_API_KEY.");
  }
  return (client ??= new Parallel({
    apiKey: config.parallel.apiKey,
    timeout: config.externalTimeoutMs,
    maxRetries: 2,
    logLevel: "error",
  }));
}

export async function discoverLiveEvents(input: {
  city: string;
  interests: string[];
  from: string;
  to: string;
  budget: string;
}) {
  const config = serverConfig();
  const task = await parallelClient().taskRun.create({
    processor: config.parallel.processor,
    input: {
      objective: "Find real public events or experiences that the user can attend in the requested place and time window.",
      city: input.city,
      interests: input.interests,
      from: input.from,
      to: input.to,
      budget: input.budget,
      requirements: [
        "Use current live web sources.",
        "Only include an event when the date is stated by a source.",
        "Use a direct event or organizer URL when available.",
        "Do not invent dates, venues, prices, descriptions or URLs.",
        "Return no more than six high-confidence results.",
      ],
    },
    task_spec: {
      output_schema: {
        type: "json",
        json_schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            events: {
              type: "array",
              maxItems: 6,
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  title: { type: "string", description: "Exact public name of the event or experience." },
                  url: { type: ["string", "null"], description: "Direct source URL." },
                  when: { type: ["string", "null"], description: "Human-readable date and time as stated by the source." },
                  start_iso: { type: ["string", "null"], description: "RFC 3339 start time with UTC offset when it can be verified." },
                  venue: { type: ["string", "null"] },
                  summary: { type: "string" },
                  evidence: { type: ["string", "null"], description: "Short source-supported date/location evidence, paraphrased." },
                  date_verified: { type: "boolean" },
                },
                required: ["title", "url", "when", "start_iso", "venue", "summary", "evidence", "date_verified"],
              },
            },
          },
          required: ["events"],
        },
      },
    },
    metadata: { feature: "events", product: "clon" },
  });
  const result = await parallelClient().taskRun.result(task.run_id, {
    timeout: Math.max(5, Math.ceil(config.externalTimeoutMs / 1_000)),
  });
  if (result.output.type !== "json") {
    throw new AppError("PARALLEL_INVALID_OUTPUT", 502, "Parallel returned an unexpected event result.");
  }
  const parsed = outputSchema.safeParse(result.output.content);
  if (!parsed.success) {
    throw new AppError("PARALLEL_INVALID_OUTPUT", 502, "Parallel returned event data that did not pass validation.");
  }
  const items: EventOption[] = parsed.data.events.map((event) => ({
    title: event.title,
    ...(event.url ? { url: event.url } : {}),
    ...(event.when ? { when: event.when } : {}),
    ...(event.start_iso ? { startISO: event.start_iso } : {}),
    ...(event.venue ? { venue: event.venue } : {}),
    summary: event.summary,
    ...(event.evidence ? { evidence: event.evidence } : {}),
    dateVerified: event.date_verified,
  }));
  return { items, runId: task.run_id, interactionId: task.interaction_id };
}

