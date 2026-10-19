"use client";

import { useEffect, useMemo, useState } from "react";
import { useClon } from "./store";
import type { CalendarEvent, CloneId, EmailMessage } from "./types";
import { atLocal, browserClock, type Clock } from "./time";
import { eventsInRange, redactFor } from "./availability";

export function useHydrated() {
  return useClon((s) => s.hydrated);
}

/** A ticking clock, `null` until mounted so server and client markup match. */
export function useClock(intervalMs = 30_000): Clock | null {
  const [clock, setClock] = useState<Clock | null>(null);
  useEffect(() => {
    setClock(browserClock());
    const t = setInterval(() => setClock(browserClock()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return clock;
}

export function usePendingApprovals() {
  const approvals = useClon((s) => s.approvals);
  return useMemo(() => approvals.filter((a) => a.status === "pending"), [approvals]);
}

export function useIsLive() {
  return useClon((s) => s.mode === "live");
}

interface CalendarView {
  events: CalendarEvent[];
  loading: boolean;
  error: string | null;
  source: "demo" | "google";
  redacted: number;
}

/**
 * The shared calendar as seen by a given clone. Demo mode reads the local demo
 * calendar; live mode asks the server, which reads Google Calendar through Composio.
 * Both paths apply the same permission-based redaction.
 */
export function useCalendar(viewer: CloneId, fromDay = -1, toDay = 7): CalendarView {
  const mode = useClon((s) => s.mode);
  const demoEvents = useClon((s) => s.calendar);
  const shareWork = useClon((s) => !!s.permissions.work.shareContext);
  const hydrated = useHydrated();
  const [live, setLive] = useState<{ events: CalendarEvent[]; error: string | null; loading: boolean; redacted: number }>({
    events: [],
    error: null,
    loading: false,
    redacted: 0,
  });

  useEffect(() => {
    if (mode !== "live" || !hydrated) return;
    const clock = browserClock();
    const ctrl = new AbortController();
    const params = new URLSearchParams({
      from: new Date(atLocal(clock, fromDay, 0)).toISOString(),
      to: new Date(atLocal(clock, toDay, 23, 59)).toISOString(),
      viewer,
      shareWork: String(shareWork),
    });
    setLive((l) => ({ ...l, loading: true, error: null }));
    fetch(`/api/calendar/events?${params}`, { signal: ctrl.signal })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Calendar unavailable");
        setLive({ events: data.events, error: null, loading: false, redacted: data.redacted ?? 0 });
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setLive({ events: [], error: e.message, loading: false, redacted: 0 });
      });
    return () => ctrl.abort();
  }, [mode, hydrated, viewer, fromDay, toDay, shareWork]);

  const demo = useMemo(() => {
    const clock = browserClock();
    const inRange = eventsInRange(demoEvents, atLocal(clock, fromDay, 0), atLocal(clock, toDay, 23, 59));
    return redactFor(inRange, viewer, { shareWork, categorized: true });
  }, [demoEvents, viewer, fromDay, toDay, shareWork]);

  if (mode === "live") return { ...live, source: "google" };
  return { events: demo.events, redacted: demo.redacted, loading: !hydrated, error: null, source: "demo" };
}

interface InboxView {
  emails: EmailMessage[];
  loading: boolean;
  error: string | null;
  source: "demo" | "gmail";
}

export function useInbox(): InboxView {
  const mode = useClon((s) => s.mode);
  const demoEmails = useClon((s) => s.emails);
  const hydrated = useHydrated();
  const [live, setLive] = useState<{ emails: EmailMessage[]; error: string | null; loading: boolean }>({
    emails: [],
    error: null,
    loading: false,
  });

  useEffect(() => {
    if (mode !== "live" || !hydrated) return;
    const ctrl = new AbortController();
    setLive((l) => ({ ...l, loading: true, error: null }));
    fetch("/api/mail/inbox", { signal: ctrl.signal })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Inbox unavailable");
        setLive({ emails: data.emails, error: null, loading: false });
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setLive({ emails: [], error: e.message, loading: false });
      });
    return () => ctrl.abort();
  }, [mode, hydrated]);

  if (mode === "live") return { ...live, source: "gmail" };
  return { emails: demoEmails, loading: !hydrated, error: null, source: "demo" };
}

/** Pointer position as CSS variables for spotlight effects. */
export function spotlightHandlers() {
  return {
    onMouseMove: (e: React.MouseEvent<HTMLElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
      e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
    },
  };
}
