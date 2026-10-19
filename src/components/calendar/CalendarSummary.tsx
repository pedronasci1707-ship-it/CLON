"use client";

import { CalendarDays, EyeOff } from "lucide-react";
import { useMemo, useState } from "react";
import { freeWindows } from "@/lib/availability";
import { useCalendar, useClock } from "@/lib/hooks";
import { atLocal, LOCALE } from "@/lib/time";
import type { CalendarEvent, CloneId } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ModeBadge } from "@/components/ui/Badge";
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
        <ModeBadge mode={cal.source === "google" ? "live" : "demo"} className="ml-auto" />
      </div>

      {cal.redacted > 0 && (
        <div className="mb-2 flex items-center gap-1.5 text-[11px] text-faint">
          <EyeOff className="h-3 w-3" /> {cal.redacted} work event{cal.redacted > 1 ? "s" : ""} shown as “Busy” — private to the Work clone
        </div>
      )}

      {cal.error ? (
        <ErrorState title="Calendar unavailable" body={cal.error} />
      ) : cal.loading || !view ? (
        <LoadingState lines={4} />
      ) : view.rows.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Nothing scheduled" body="A fully open day." />
      ) : (
        <ul className="space-y-1.5">
          {view.rows.map((r, i) =>
            r.kind === "event" ? (
              <li
                key={r.e.id}
                className={cn(
                  "flex items-center gap-3 rounded-xl border border-line bg-white/[0.02] px-3 py-2",
                  Date.parse(r.e.end) < view.now && "opacity-45",
                )}
              >
                <span
                  className="h-7 w-[3px] shrink-0 rounded-full"
                  style={{ background: r.e.category ? CATEGORY_COLOR[r.e.category] : "#8593b3" }}
                />
                <div className="min-w-0 flex-1">
                  <div className={cn("truncate text-[13px]", r.e.redacted ? "italic text-mute" : "text-ink")}>{r.e.title}</div>
                  <div className="font-mono text-[10px] text-faint">
                    {tf(r.e.start)} – {tf(r.e.end)}
                    {r.e.location && !r.e.redacted ? ` · ${r.e.location}` : ""}
                  </div>
                </div>
                {r.e.source === "clon" && (
                  <span className="shrink-0 font-mono text-[9px] uppercase tracking-widest text-cyan" title="Added by CLON after your approval (demo)">
                    by clon
                  </span>
                )}
                {Date.parse(r.e.start) <= view.now && Date.parse(r.e.end) > view.now && (
                  <span className="shrink-0 font-mono text-[9px] uppercase tracking-widest text-ok">now</span>
                )}
              </li>
            ) : (
              <li key={`free-${i}`} className="flex items-center gap-3 rounded-xl border border-dashed border-ok/20 px-3 py-1.5">
                <span className="h-5 w-[3px] shrink-0 rounded-full bg-ok/40" />
                <span className="text-[12px] text-ok/90">Free</span>
                <span className="font-mono text-[10px] text-faint">
                  {tf(r.start)} – {tf(r.end)} · {Math.round(r.minutes / 6) / 10}h
                </span>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
