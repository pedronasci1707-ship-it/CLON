"use client";

import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { useMemo, type CSSProperties } from "react";
import { CLONES } from "@/lib/clones";
import { usePendingApprovals } from "@/lib/hooks";
import { useClon } from "@/lib/store";
import type { Autonomy, CalendarAccess, SpecialistId } from "@/lib/types";
import { ActivityTimeline } from "@/components/activity/ActivityTimeline";
import { ApprovalCard } from "@/components/approvals/ApprovalCard";
import { CalendarSummary } from "@/components/calendar/CalendarSummary";
import { Badge } from "@/components/ui/Badge";
import { CloneSigil } from "@/components/ui/CloneSigil";
import { GlassPanel, SectionHeader } from "@/components/ui/GlassPanel";
import { StatusIndicator, type AgentState } from "@/components/ui/StatusIndicator";
import { AgentConsole } from "./AgentConsole";

export const AUTONOMY_LABEL: Record<Autonomy, string> = {
  read_only: "Read only",
  draft: "Drafts only",
  approval: "Approval required",
  limited: "Limited autonomy",
};

export const CALENDAR_LABEL: Record<CalendarAccess, string> = {
  none: "No calendar access",
  read: "Reads calendar",
  propose: "Proposes calendar changes",
};

/**
 * Shared layout for every specialist clone: identity, domain panels, a
 * dedicated console, the shared calendar, approvals and history.
 */
export function AgentWorkspace({
  clone,
  summary,
  children,
  consoleTitle,
}: {
  clone: SpecialistId;
  summary?: React.ReactNode;
  children: React.ReactNode;
  consoleTitle?: string;
}) {
  const def = CLONES[clone];
  const perm = useClon((s) => s.permissions[clone]);
  const running = useClon((s) => s.running);
  const activity = useClon((s) => s.activity);
  const pending = usePendingApprovals().filter((a) => a.clone === clone);
  const mine = useMemo(() => activity.filter((a) => a.clone === clone), [activity, clone]);

  const state: AgentState = !perm.enabled
    ? "disabled"
    : running?.activeClones.includes(clone)
      ? "working"
      : pending.length
        ? "attention"
        : "idle";

  return (
    <div className="mx-auto max-w-[1560px]" style={{ "--accent": def.accent } as CSSProperties}>
      {/* Identity */}
      <header className="relative mb-8 flex items-center gap-5">
        <div
          className="pointer-events-none absolute -left-10 -top-16 h-56 w-[36rem] max-w-full rounded-full opacity-80 blur-2xl"
          style={{ background: `radial-gradient(closest-side, ${def.accent}22, transparent)` }}
          aria-hidden
        />
        <CloneSigil clone={clone} size={60} active={state === "working"} className="relative" />
        <div className="relative min-w-0">
          <h1 className="font-display text-[30px] font-medium leading-tight tracking-tight text-ink sm:text-[36px]" title={def.mission}>
            {def.short}
          </h1>
          <StatusIndicator state={state} className="mt-1" />
        </div>
        <div className="relative ml-auto flex items-center gap-2">
          {!perm.enabled && <Badge tone="warn">Paused</Badge>}
          <Link
            href="/settings#permissions"
            className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-white/[0.02] text-mute transition-colors hover:border-accent-soft hover:text-accent"
            aria-label="Permissions"
            title={`${AUTONOMY_LABEL[perm.autonomy]} · ${CALENDAR_LABEL[perm.calendar]}`}
          >
            <SlidersHorizontal className="h-4 w-4" strokeWidth={1.6} />
          </Link>
        </div>
      </header>

      {summary && <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">{summary}</div>}

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="min-w-0 space-y-5 xl:col-span-7 2xl:col-span-8">{children}</div>

        <aside className="min-w-0 space-y-5 xl:col-span-5 2xl:col-span-4">
          <GlassPanel className="flex h-[600px] flex-col">
            <SectionHeader title={consoleTitle ?? "Console"} />
            <AgentConsole clone={clone} className="min-h-0 flex-1" />
          </GlassPanel>

          {pending.length > 0 && (
            <GlassPanel>
              <SectionHeader title="Approvals" count={pending.length} />
              <div className="space-y-3">
                {pending.map((a) => (
                  <ApprovalCard key={a.id} approval={a} compact />
                ))}
              </div>
            </GlassPanel>
          )}

          <GlassPanel>
            <SectionHeader title="Calendar" />
            <CalendarSummary viewer={clone} days={[0, 1, 2]} />
          </GlassPanel>

          <GlassPanel>
            <SectionHeader title="Activity" />
            <ActivityTimeline entries={mine} limit={5} />
          </GlassPanel>
        </aside>
      </div>
    </div>
  );
}
