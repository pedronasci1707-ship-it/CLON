// Timezone-aware helpers that work identically in the browser and on the server.
// `tzOffset` follows Date#getTimezoneOffset(): minutes *behind* UTC (PDT = 420).

/** The UI is written in English, so dates and times are formatted consistently in en-US. */
export const LOCALE = "en-US";

const MIN = 60_000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

export interface Clock {
  now: number;
  tzOffset: number;
  timeZone?: string;
}

/** A Date whose UTC fields read as the user's wall-clock time. */
function wall(ms: number, tzOffset: number) {
  return new Date(ms - tzOffset * MIN);
}

/** Absolute time for a wall-clock moment `dayDelta` days from today. */
export function atLocal(clock: Clock, dayDelta: number, hour: number, minute = 0): number {
  const w = wall(clock.now, clock.tzOffset);
  w.setUTCDate(w.getUTCDate() + dayDelta);
  w.setUTCHours(hour, minute, 0, 0);
  return w.getTime() + clock.tzOffset * MIN;
}

export function localHour(ms: number, tzOffset: number) {
  const w = wall(ms, tzOffset);
  return w.getUTCHours() + w.getUTCMinutes() / 60;
}

export function localWeekday(ms: number, tzOffset: number) {
  return wall(ms, tzOffset).getUTCDay();
}

/** Calendar-day distance between two instants in the user's timezone. */
export function dayDiff(clock: Clock, ms: number) {
  const a = atLocal(clock, 0, 0);
  const b = atLocal({ ...clock, now: ms }, 0, 0);
  return Math.round((b - a) / DAY);
}

/** Local wall time as "YYYY-MM-DDTHH:MM:SS" (no offset) — used for APIs that take a separate timezone. */
export function toLocalNaive(ms: number, tzOffset: number) {
  return wall(ms, tzOffset).toISOString().slice(0, 19);
}

function safeTimeZone(timeZone?: string) {
  if (!timeZone) return undefined;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return timeZone;
  } catch {
    return undefined;
  }
}

function format(ms: number, clock: Pick<Clock, "tzOffset" | "timeZone">, opts: Intl.DateTimeFormatOptions) {
  const tz = safeTimeZone(clock.timeZone);
  if (tz) return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: tz }).format(ms);
  return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" }).format(wall(ms, clock.tzOffset));
}

export function fmtTime(iso: string | number, clock: Pick<Clock, "tzOffset" | "timeZone">) {
  const ms = typeof iso === "number" ? iso : Date.parse(iso);
  return format(ms, clock, { hour: "numeric", minute: "2-digit" });
}

export function fmtDay(iso: string | number, clock: Pick<Clock, "tzOffset" | "timeZone">) {
  const ms = typeof iso === "number" ? iso : Date.parse(iso);
  return format(ms, clock, { weekday: "long", month: "short", day: "numeric" });
}

export function fmtRange(start: string, end: string, clock: Pick<Clock, "tzOffset" | "timeZone">) {
  return `${fmtTime(start, clock)} – ${fmtTime(end, clock)}`;
}

export function relativeDayLabel(clock: Clock, ms: number) {
  const d = dayDiff(clock, ms);
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d === -1) return "Yesterday";
  return format(ms, clock, { weekday: "long" });
}

// ── Browser-only conveniences (rendered after hydration) ──

export function browserClock(): Clock {
  return {
    now: Date.now(),
    tzOffset: new Date().getTimezoneOffset(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

export function timeAgo(iso: string, now = Date.now()) {
  const diff = Math.max(0, now - Date.parse(iso));
  const m = Math.round(diff / MIN);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export function hhmm(iso: string) {
  return new Date(iso).toLocaleTimeString(LOCALE, { hour: "numeric", minute: "2-digit" });
}
