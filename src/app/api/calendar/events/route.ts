import { readCalendar } from "@/server/integrations/calendar";
import { enforceRateLimit, json, jsonError, requestId } from "@/server/http";
import { calendarQuerySchema } from "@/server/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    enforceRateLimit(request, "calendar-read", 60);
    const url = new URL(request.url);
    const parsed = calendarQuerySchema.parse(Object.fromEntries(url.searchParams));
    const result = await readCalendar({ ...parsed, signal: request.signal });
    return json({ events: result.events, redacted: result.redacted, source: result.source }, { status: 200, requestId: id });
  } catch (error) {
    return jsonError(error, id, "/api/calendar/events");
  }
}

