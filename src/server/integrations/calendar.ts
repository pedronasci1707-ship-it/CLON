import "server-only";

import { createHash } from "node:crypto";
import type { CalendarEvent, CloneId, ProposedEvent } from "@/lib/types";
import { redactFor } from "@/lib/availability";
import { serverConfig } from "../config";
import { AppError } from "../errors";
import { collectRecords, firstString, isRecord, nestedRecord, validIso } from "./normalize";
import { executeUseCase } from "./composio";

interface CalendarReadOptions {
  from: string;
  to: string;
  viewer: CloneId;
  shareWork: boolean;
  timeZone?: string;
  signal?: AbortSignal;
}

function eventTime(record: Record<string, unknown>, key: "start" | "end") {
  const direct = record[key];
  if (typeof direct === "string" || typeof direct === "number") return validIso(direct);
  const nested = isRecord(direct) ? direct : nestedRecord(record, [`${key}Time`, `${key}_time`]);
  if (nested) return validIso(firstString(nested, ["dateTime", "date_time", "datetime", "date", "value"]));
  return validIso(
    firstString(record, [
      `${key}DateTime`,
      `${key}_date_time`,
      `${key}Datetime`,
      `${key}_datetime`,
      `${key}Time`,
      `${key}_time`,
      `${key}Date`,
      `${key}_date`,
    ]),
  );
}

function categoryOf(title: string): CalendarEvent["category"] {
  const text = title.toLowerCase();
  if (/workout|gym|run|strength|yoga|cycle|swim|fitness|training/.test(text)) return "fitness";
  if (/dinner|lunch|party|coffee|meetup|concert|friend/.test(text)) return "social";
  if (/standup|review|sync|meeting|call|workshop|interview|brief|focus|roadmap|board/.test(text)) return "work";
  return "personal";
}

function normalizeEvents(data: unknown, from: string, to: string): CalendarEvent[] {
  const min = Date.parse(from);
  const max = Date.parse(to);
  const events: CalendarEvent[] = [];
  const seen = new Set<string>();

  for (const record of collectRecords(data)) {
    const start = eventTime(record, "start");
    const end = eventTime(record, "end");
    const title = firstString(record, ["summary", "title", "name", "eventTitle", "event_title"]);
    if (!start || !end || !title || Date.parse(end) <= Date.parse(start)) continue;
    if (Date.parse(start) >= max || Date.parse(end) <= min) continue;
    const rawId = firstString(record, ["id", "eventId", "event_id", "iCalUID", "ical_uid"]);
    const id = rawId ?? `google_${createHash("sha1").update(`${title}|${start}|${end}`).digest("hex").slice(0, 20)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const location = firstString(record, ["location", "venue", "place"]);
    const description = firstString(record, ["description", "details", "notes"]);
    const link = firstString(record, ["htmlLink", "html_link", "link", "url"]);
    events.push({
      id,
      title,
      start,
      end,
      ...(location ? { location } : {}),
      ...(description ? { description } : {}),
      category: categoryOf(title),
      source: "google",
      ...(link && /^https?:\/\//i.test(link) ? { link } : {}),
    });
  }
  return events.sort((a, b) => Date.parse(a.start) - Date.parse(b.start)).slice(0, 500);
}

export async function readCalendar(options: CalendarReadOptions) {
  const result = await executeUseCase({
    toolkit: "googlecalendar",
    useCase: `List all events in the primary Google Calendar from ${options.from} through ${options.to}. Return event ids, titles, start and end date-times, descriptions, locations and links.`,
    preferredSlugParts: ["LIST", "EVENT", "FIND", "GET"],
    forbiddenSlugParts: ["CREATE", "DELETE", "REMOVE", "UPDATE", "PATCH"],
    configuredSlug: serverConfig().composio.tools.calendarList,
    arguments: {
      calendarId: "primary",
      from: options.from,
      to: options.to,
      maxResults: 250,
      timeZone: options.timeZone,
    },
    timeZone: options.timeZone,
    signal: options.signal,
  });
  const normalized = normalizeEvents(result.data, options.from, options.to);
  // Google event categories are not guaranteed to be reliable. For Life/Fitness,
  // fail private and hide all titles unless the user explicitly shares work context.
  const redacted = redactFor(normalized, options.viewer, { shareWork: options.shareWork, categorized: false });
  return { ...redacted, source: "google" as const, tool: result.slug, logId: result.logId };
}

export async function createCalendarEvents(
  events: ProposedEvent[],
  options: { clone: CloneId; timeZone?: string; approvalId: string; signal?: AbortSignal },
) {
  const created: CalendarEvent[] = [];
  for (const event of events) {
    const description = [event.description, `Created by CLON ${options.clone} clone. Approval: ${options.approvalId}`]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 5_000);
    const result = await executeUseCase({
      toolkit: "googlecalendar",
      useCase: "Create exactly one event in the primary Google Calendar. Do not invite attendees and do not create a recurring event.",
      preferredSlugParts: ["CREATE", "EVENT"],
      forbiddenSlugParts: ["DELETE", "REMOVE", "UPDATE", "QUICK_ADD"],
      configuredSlug: serverConfig().composio.tools.calendarCreate,
      arguments: {
        calendarId: "primary",
        title: event.title,
        start: event.start,
        end: event.end,
        description,
        timeZone: options.timeZone,
      },
      timeZone: options.timeZone,
      signal: options.signal,
    });
    const records = collectRecords(result.data);
    const best = records.find((record) => firstString(record, ["id", "eventId", "event_id"])) ?? records[0] ?? {};
    const id = firstString(best, ["id", "eventId", "event_id"]) ??
      `google_${createHash("sha1").update(`${event.title}|${event.start}|${options.approvalId}`).digest("hex").slice(0, 20)}`;
    const link = firstString(best, ["htmlLink", "html_link", "link", "url"]);
    created.push({
      ...event,
      id,
      source: "google",
      createdBy: options.clone,
      ...(link && /^https?:\/\//i.test(link) ? { link } : {}),
    });
  }
  if (!created.length) throw new AppError("CALENDAR_CREATE_FAILED", 502, "Google Calendar did not return a created event.");
  return created;
}
