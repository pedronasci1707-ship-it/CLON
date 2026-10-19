"use client";

import { useMemo } from "react";
import { freeWindows, suggestTimeSlots } from "@/lib/availability";
import { useCalendar, useClock, useInbox, usePendingApprovals } from "@/lib/hooks";
import { useClon } from "@/lib/store";
import { atLocal, localHour, LOCALE, type Clock } from "@/lib/time";
import type { ActivityEntry, SpecialistId } from "@/lib/types";
import type { AgentState } from "@/components/ui/StatusIndicator";

export interface Insight {
  label: string;
  value?: string;
}

export interface CloneSnapshot {
  state: AgentState;
  insights: Insight[];
  pending: number;
  latest?: ActivityEntry;
}

const t = (ms: number | string) =>
  new Date(ms).toLocaleTimeString(LOCALE, { hour: "numeric", minute: "2-digit" });

export function useCloneInsights(): Record<SpecialistId, CloneSnapshot> | null {
  const clock = useClock(60_000);
  const hydrated = useClon((s) => s.hydrated);
  const profile = useClon((s) => s.profile);
  const tasks = useClon((s) => s.tasks);
  const workouts = useClon((s) => s.workouts);
  const activity = useClon((s) => s.activity);
  const permissions = useClon((s) => s.permissions);
  const running = useClon((s) => s.running);
  const mode = useClon((s) => s.mode);
  const pending = usePendingApprovals();
  const inbox = useInbox();
  const workCal = useCalendar("work", 0, 2);
  const fitCal = useCalendar("fitness", 0, 2);

  return useMemo(() => {
    if (!hydrated || !clock) return null;
    const c: Clock = clock;
    const visibleTasks = mode === "live" ? tasks.filter((x) => !x.demo) : tasks;
    const visibleWorkouts = mode === "live" ? workouts.filter((w) => w.source === "manual") : workouts;

    const state = (id: SpecialistId, pend: number): AgentState => {
      if (!permissions[id].enabled) return "disabled";
      if (running?.activeClones.includes(id)) return "working";
      if (pend > 0) return "attention";
      return "idle";
    };
    const pendingFor = (id: SpecialistId) => pending.filter((a) => a.clone === id).length;
    const latestFor = (id: SpecialistId) => activity.find((a) => a.clone === id);

    // Communication
    const needsReply = inbox.emails.filter((e) => e.needsReply).length;
    const meetings = inbox.emails.filter((e) => e.meetingRequest).length;
    const flagged = inbox.emails.filter((e) => e.flagged).length;
    const unread = inbox.emails.filter((e) => e.unread).length;

    // Work
    const open = visibleTasks.filter((x) => x.status !== "done");
    const p0 = open.filter((x) => x.priority === "p0").length;
    const nextWork = workCal.events.find((e) => Date.parse(e.start) > c.now && (e.category === "work" || e.source === "google"));
    const focus = freeWindows(
      workCal.events,
      Math.max(c.now, atLocal(c, 0, profile.workdayStart)),
      atLocal(c, 0, profile.workdayEnd),
      45,
      5,
    ).sort((a, b) => b.minutes - a.minutes)[0];

    // Life
    const tonight = freeWindows(fitCal.events, Math.max(c.now, atLocal(c, 0, 18)), atLocal(c, 0, 23), 60)[0];

    // Fitness
    const weekStart = c.now - 7 * 86_400_000;
    const recent = visibleWorkouts.filter((w) => Date.parse(w.date) >= weekStart);
    const minutes = recent.reduce((s, w) => s + w.durationMin, 0);
    const prefer = profile.preferredWorkoutTime === "morning" ? 7 : profile.preferredWorkoutTime === "midday" ? 12.5 : 18;
    const best = suggestTimeSlots({
      events: fitCal.events,
      from: atLocal(c, 1, 6),
      to: atLocal(c, 1, 21),
      durationMin: 45,
      preferHour: prefer,
      localHourOf: (ms) => localHour(ms, c.tzOffset),
      limit: 1,
    })[0];

    return {
      communication: {
        state: state("communication", pendingFor("communication")),
        pending: pendingFor("communication"),
        latest: latestFor("communication"),
        insights: inbox.error
          ? [{ label: "Inbox unavailable", value: "check connection" }]
          : [
              { label: needsReply === 1 ? "email needs a reply" : "emails need a reply", value: String(needsReply) },
              { label: meetings === 1 ? "meeting request detected" : "meeting requests detected", value: String(meetings) },
              flagged
                ? { label: flagged === 1 ? "suspicious instruction ignored" : "suspicious instructions ignored", value: String(flagged) }
                : { label: "unread", value: String(unread) },
            ],
      },
      work: {
        state: state("work", pendingFor("work")),
        pending: pendingFor("work"),
        latest: latestFor("work"),
        insights: [
          { label: p0 === 1 ? "top-priority task open" : "top-priority tasks open", value: String(p0) },
          nextWork ? { label: `Next · ${nextWork.title}`, value: t(nextWork.start) } : { label: "No more meetings today" },
          focus ? { label: "Longest focus window", value: `${t(focus.start)}–${t(focus.end)}` } : { label: "No focus window left today" },
        ],
      },
      life: {
        state: state("life", pendingFor("life")),
        pending: pendingFor("life"),
        latest: latestFor("life"),
        insights: [
          tonight ? { label: "Free tonight from", value: t(tonight.start) } : { label: "Tonight is booked" },
          { label: "Exploring", value: profile.city },
          { label: `Into ${profile.interests.slice(0, 3).join(" · ")}` },
        ],
      },
      fitness: {
        state: state("fitness", pendingFor("fitness")),
        pending: pendingFor("fitness"),
        latest: latestFor("fitness"),
        insights: [
          { label: `sessions · last 7 days (goal ${profile.weeklySessionGoal})`, value: String(recent.length) },
          { label: "active minutes this week", value: String(minutes) },
          best ? { label: "Best 45-min slot tomorrow", value: t(best.start) } : { label: "No 45-min slot tomorrow" },
        ],
      },
    };
  }, [hydrated, clock, mode, tasks, workouts, activity, permissions, running, pending, inbox, workCal.events, fitCal.events, profile]);
}
