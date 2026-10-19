"use client";

import { useMemo } from "react";
import { freeWindows } from "@/lib/availability";
import { useCalendar, useClock, useInbox, usePendingApprovals } from "@/lib/hooks";
import { useClon } from "@/lib/store";
import { atLocal, LOCALE, type Clock } from "@/lib/time";
import type { SpecialistId } from "@/lib/types";
import type { AgentState } from "@/components/ui/StatusIndicator";

/** One number that sums up a clone at a glance. */
export interface Metric {
  value: string;
  label: string;
}

export interface CloneSnapshot {
  state: AgentState;
  metric: Metric;
  pending: number;
}

const t = (ms: number | string) =>
  new Date(ms).toLocaleTimeString(LOCALE, { hour: "numeric", minute: "2-digit" });

export function useCloneInsights(): Record<SpecialistId, CloneSnapshot> | null {
  const clock = useClock(60_000);
  const hydrated = useClon((s) => s.hydrated);
  const profile = useClon((s) => s.profile);
  const tasks = useClon((s) => s.tasks);
  const workouts = useClon((s) => s.workouts);
  const permissions = useClon((s) => s.permissions);
  const running = useClon((s) => s.running);
  const mode = useClon((s) => s.mode);
  const pending = usePendingApprovals();
  const inbox = useInbox();
  const lifeCal = useCalendar("life", 0, 0);

  return useMemo(() => {
    if (!hydrated || !clock) return null;
    const c: Clock = clock;
    const visibleTasks = mode === "live" ? tasks.filter((x) => !x.demo) : tasks;
    const visibleWorkouts = mode === "live" ? workouts.filter((w) => w.source === "manual") : workouts;

    const pendingFor = (id: SpecialistId) => pending.filter((a) => a.clone === id).length;
    const snapshot = (id: SpecialistId, metric: Metric): CloneSnapshot => {
      const pend = pendingFor(id);
      const state: AgentState = !permissions[id].enabled
        ? "disabled"
        : running?.activeClones.includes(id)
          ? "working"
          : pend > 0
            ? "attention"
            : "idle";
      return { state, metric, pending: pend };
    };

    const needsReply = inbox.emails.filter((e) => e.needsReply).length;
    const p0 = visibleTasks.filter((x) => x.status !== "done" && x.priority === "p0").length;
    const tonight = freeWindows(lifeCal.events, Math.max(c.now, atLocal(c, 0, 18)), atLocal(c, 0, 23), 60)[0];
    const sessions = visibleWorkouts.filter((w) => Date.parse(w.date) >= c.now - 7 * 86_400_000).length;

    return {
      communication: snapshot("communication", inbox.error ? { value: "—", label: "offline" } : { value: String(needsReply), label: "to reply" }),
      work: snapshot("work", { value: String(p0), label: "priorities" }),
      life: snapshot("life", tonight ? { value: t(tonight.start), label: "free tonight" } : { value: "—", label: "booked tonight" }),
      fitness: snapshot("fitness", { value: `${sessions}/${profile.weeklySessionGoal}`, label: "sessions · 7d" }),
    };
  }, [hydrated, clock, mode, tasks, workouts, permissions, running, pending, inbox, lifeCal.events, profile.weeklySessionGoal]);
}
