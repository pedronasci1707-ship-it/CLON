// Shared availability engine. Every clone — and every client widget — computes
// free time through these functions, so "busy" means the same thing everywhere.

import type { CalendarEvent, TimeSlot } from "./types";
import { HOUR } from "./time";

const MIN = 60_000;

export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

export function eventsInRange(events: CalendarEvent[], from: number, to: number) {
  return events
    .filter((e) => overlaps(Date.parse(e.start), Date.parse(e.end), from, to))
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}

/** Merged busy intervals, optionally padded by a buffer on each side. */
export function busyIntervals(events: CalendarEvent[], from: number, to: number, bufferMin = 0) {
  const pad = bufferMin * MIN;
  const spans = eventsInRange(events, from, to)
    .map((e) => [Date.parse(e.start) - pad, Date.parse(e.end) + pad] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1]);
    else merged.push([...s]);
  }
  return merged;
}

/** Free windows between `from` and `to` that are at least `minMinutes` long. */
export function freeWindows(
  events: CalendarEvent[],
  from: number,
  to: number,
  minMinutes = 15,
  bufferMin = 0,
): TimeSlot[] {
  const out: TimeSlot[] = [];
  let cursor = from;
  for (const [s, e] of busyIntervals(events, from, to, bufferMin)) {
    if (s > cursor) push(cursor, Math.min(s, to));
    cursor = Math.max(cursor, e);
    if (cursor >= to) break;
  }
  if (cursor < to) push(cursor, to);
  return out;

  function push(a: number, b: number) {
    const minutes = Math.round((b - a) / MIN);
    if (minutes >= minMinutes) {
      out.push({ start: new Date(a).toISOString(), end: new Date(b).toISOString(), minutes });
    }
  }
}

export function conflictsWith(events: CalendarEvent[], start: number, end: number) {
  return eventsInRange(events, start, end);
}

export interface SuggestOptions {
  events: CalendarEvent[];
  from: number;
  to: number;
  durationMin: number;
  bufferMin?: number;
  /** Preferred local hour (e.g. 7.5) — slots closer to it score higher. */
  preferHour?: number;
  /** Convert an absolute time to the user's local hour. */
  localHourOf: (ms: number) => number;
  stepMin?: number;
  limit?: number;
  /** Earliest allowed start (e.g. "not in the past"). */
  notBefore?: number;
}

/**
 * Ranked candidate slots of `durationMin` that fit inside free windows,
 * keeping a buffer around existing commitments.
 */
export function suggestTimeSlots(opts: SuggestOptions): TimeSlot[] {
  const { events, durationMin, localHourOf } = opts;
  const buffer = opts.bufferMin ?? 10;
  const step = (opts.stepMin ?? 15) * MIN;
  const from = Math.max(opts.from, roundUp(opts.notBefore ?? opts.from, step));
  const windows = freeWindows(events, from, opts.to, durationMin, buffer);
  const candidates: TimeSlot[] = [];

  for (const w of windows) {
    const ws = roundUp(Date.parse(w.start), step);
    const we = Date.parse(w.end);
    for (let s = ws; s + durationMin * MIN <= we; s += step) {
      const e = s + durationMin * MIN;
      const hour = localHourOf(s);
      let score = 100;
      if (opts.preferHour !== undefined) score -= Math.abs(hour - opts.preferHour) * 9;
      // Prefer slots that leave breathing room rather than filling a window edge-to-edge.
      const roomBefore = (s - Date.parse(w.start)) / HOUR;
      const roomAfter = (we - e) / HOUR;
      score += Math.min(roomBefore, 1) * 4 + Math.min(roomAfter, 1) * 4;
      candidates.push({
        start: new Date(s).toISOString(),
        end: new Date(e).toISOString(),
        minutes: durationMin,
        score: Math.round(score),
      });
    }
  }

  // Pick the best slots while keeping them meaningfully apart (≥ 75 min).
  candidates.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const picked: TimeSlot[] = [];
  for (const c of candidates) {
    const cs = Date.parse(c.start);
    if (picked.every((p) => Math.abs(Date.parse(p.start) - cs) >= 75 * MIN)) picked.push(c);
    if (picked.length >= (opts.limit ?? 4)) break;
  }
  return picked;
}

function roundUp(ms: number, step: number) {
  return Math.ceil(ms / step) * step;
}

/** Hide titles of events the viewing clone is not allowed to see. */
export function redactFor(
  events: CalendarEvent[],
  viewer: string,
  opts: { shareWork: boolean; categorized: boolean },
): { events: CalendarEvent[]; redacted: number } {
  if (viewer === "work" || viewer === "master" || viewer === "communication") return { events, redacted: 0 };
  let redacted = 0;
  const out = events.map((e) => {
    const sensitive = opts.categorized ? e.category === "work" : true;
    if (sensitive && !opts.shareWork) {
      redacted++;
      return { ...e, title: "Busy", description: undefined, location: undefined, redacted: true };
    }
    return e;
  });
  return { events: out, redacted };
}
