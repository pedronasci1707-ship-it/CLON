"use client";

import { CalendarDays, EyeOff, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { freeWindows } from "@/lib/availability";
import { useCalendar, useClock } from "@/lib/hooks";
import { atLocal, LOCALE } from "@/lib/time";
import type { CalendarEvent, CloneId } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";

const CATEGORY_COLOR: Record<NonNullable<CalendarEvent["category"]>, string> = {
  work: "#8088ff",
  personal: "#3fd8c4",
  fitness: "#c4f25f",
  social: "#5aa8ff",
};

const tf = (iso: string) => new Date(iso).toLocaleTimeString(LOCALE, { hour: "numeric", minute: "2-digit" });

/**
 * The shared calendar, rendered from the point of view of one clone.
 * Every workspace uses this same component and the same availability engine.
 */
export function CalendarSummary({
  viewer,
  days = [0, 1],
  showFree = true,
  className,
}: {
  viewer: CloneId;
  days?: number[];
  showFree?: boolean;
  className?: string;
}) {
  const clock = useClock(60_000);
  const cal = useCalendar(viewer, Math.min(...days), Math.max(...days));
  const [day, setDay] = useState(days[0]);

  const view = useMemo(() => {
    if (!clock) return null;
    const from = atLocal(clock, day, 0);
    const to = atLocal(clock, day, 23, 59);
    const events = cal.events.filter((e) => Date.parse(e.start) < to && Date.parse(e.end) > from);
    const free = showFree
      ? freeWindows(cal.events, Math.max(from + 7 * 3_600_000, day === 0 ? clock.now : 0), from + 22 * 3_600_000, 45)
      : [];
    type Row = { kind: "event"; e: CalendarEvent; at: number } | { kind: "free"; start: string; end: string; minutes: number; at: number };
    const rows: Row[] = [
      ...events.map((e) => ({ kind: "event" as const, e, at: Date.parse(e.start) })),
      ...free.map((f) => ({ kind: "free" as const, ...f, at: Date.parse(f.start) })),
    ].sort((a, b) => a.at - b.at);
    return { rows, now: clock.now };
  }, [clock, cal.events, day, showFree]);

  const label = (d: number) => (d === 0 ? "Today" : d === 1 ? "Tomorrow" : clock ? new Date(atLocal(clock, d, 12)).toLocaleDateString(LOCALE, { weekday: "short" }) : "");

  return (
    <div className={className}>
      <div className="mb-3 flex items-center gap-2">
        <div className="flex rounded-lg border border-line p-0.5">
          {days.map((d) => (
            <button
              key={d}
              onClick={() => setDay(d)}
              className={cn(
                "rounded-md px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
                day === d ? "bg-white/[0.07] text-ink" : "text-faint hover:text-mute",
              )}
            >
              {label(d)}
            </button>
          ))}
        </div>
        {cal.redacted > 0 && (
          <span
            className="ml-auto flex items-center gap-1 font-mono text-[10px] text-faint"
            title={`${cal.redacted} work event${cal.redacted > 1 ? "s" : ""} shown as “Busy” — private to the Work clone`}
          >
            <EyeOff className="h-3 w-3" /> {cal.redacted}
          </span>
        )}
      </div>

      {cal.error ? (
        <ErrorState title="Calendar unavailable" body={cal.error} />
      ) : cal.loading || !view ? (
        <LoadingState lines={4} />
      ) : view.rows.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Open day" />
      ) : (
        <ul className="space-y-1">
          {view.rows.map((r, i) =>
            r.kind === "event" ? (
              <li
                key={r.e.id}
                title={r.e.location && !r.e.redacted ? r.e.location : undefined}
                className={cn("flex items-center gap-3 rounded-xl px-2 py-1.5", Date.parse(r.e.end) < view.now && "opacity-40")}
              >
                <span
                  className="h-6 w-[3px] shrink-0 rounded-full"
                  style={{ background: r.e.category ? CATEGORY_COLOR[r.e.category] : "#8593b3" }}
                />
                <span className="w-16 shrink-0 font-mono text-[10.5px] text-faint">{tf(r.e.start)}</span>
                <span className={cn("min-w-0 flex-1 truncate text-[13px]", r.e.redacted ? "italic text-mute" : "text-ink")}>{r.e.title}</span>
                {r.e.source === "clon" && (
                  <span title="Added by CLON after your approval">
                    <Sparkles className="h-3 w-3 shrink-0 text-cyan" />
                  </span>
                )}
                {Date.parse(r.e.start) <= view.now && Date.parse(r.e.end) > view.now && (
                  <span className="shrink-0 font-mono text-[9px] uppercase tracking-widest text-ok">now</span>
                )}
              </li>
            ) : (
              <li key={`free-${i}`} className="flex items-center gap-3 rounded-xl px-2 py-1">
                <span className="h-4 w-[3px] shrink-0 rounded-full bg-ok/30" />
                <span className="w-16 shrink-0 font-mono text-[10.5px] text-ok/70">{tf(r.start)}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ok/70">
                  Free · {Math.round(r.minutes / 6) / 10}h
                </span>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
