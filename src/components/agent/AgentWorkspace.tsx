"use client";

import Link from "next/link";
import { ArrowLeft, CalendarDays, Lock, Wrench } from "lucide-react";
import { useMemo, type CSSProperties } from "react";
import { CLONES } from "@/lib/clones";
import { usePendingApprovals } from "@/lib/hooks";
import { useClon } from "@/lib/store";
import type { Autonomy, CalendarAccess, SpecialistId } from "@/lib/types";
import { ActivityTimeline } from "@/components/activity/ActivityTimeline";
import { ApprovalCard } from "@/components/approvals/ApprovalCard";
import { CalendarSummary } from "@/components/calendar/CalendarSummary";
import { Badge, ModeBadge } from "@/components/ui/Badge";
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

const TOOL_LABEL: Record<string, string> = {
  "calendar.getEvents": "Calendar · read",
  "calendar.checkAvailability": "Calendar · availability",
  "calendar.suggestTimeSlots": "Calendar · suggest slots",
  "gmail.listMessages": "Gmail · read",
  "gmail.createDraft": "Gmail · create draft",
  "research.searchEvents": "Parallel · web research",
  "tasks.list": "Tasks · on device",
  "workouts.list": "Workouts · on device",
  "agents.delegate": "Delegate to clones",
  "approvals.request": "Request approval",
};

/**
 * Shared layout for every specialist clone: identity, mission, permissions,
 * domain panels, a dedicated console, the shared calendar, approvals and history.
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
  const hydrated = useClon((s) => s.hydrated);
  const activity = useClon((s) => s.activity);
  const pending = usePendingApprovals().filter((a) => a.clone === clone);
  const mode = useClon((s) => s.mode);
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
      <Link href="/" className="mb-5 inline-flex items-center gap-1.5 text-xs text-mute transition-colors hover:text-accent">
        <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
      </Link>

      {/* Identity */}
      <header className="relative mb-6 overflow-hidden rounded-[26px] border border-line px-5 py-6 sm:px-7">
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background: `radial-gradient(40rem 16rem at 0% 0%, ${def.accent}1c, transparent 60%), radial-gradient(30rem 14rem at 100% 100%, ${def.accentAlt}12, transparent 60%)`,
          }}
        />
        <div className="scanlines pointer-events-none absolute inset-0 opacity-30" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center">
          <div className="flex items-start gap-4">
            <CloneSigil clone={clone} size={64} active={state === "working"} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h1 className="font-display text-[26px] font-medium tracking-tight text-ink sm:text-[30px]">{def.name}</h1>
                <StatusIndicator state={state} />
              </div>
              <div className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.2em] text-accent">{def.tagline}</div>
              <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-soft">{def.mission}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 lg:ml-auto lg:items-end">
            <div className="flex flex-wrap gap-1.5 lg:justify-end">
              {hydrated && <ModeBadge mode={mode} />}
              <Badge tone="accent">
                <Lock className="h-2.5 w-2.5" /> {AUTONOMY_LABEL[perm.autonomy]}
              </Badge>
              <Badge>
                <CalendarDays className="h-2.5 w-2.5" /> {CALENDAR_LABEL[perm.calendar]}
              </Badge>
            </div>
            <div className="flex max-w-md flex-wrap gap-1.5 lg:justify-end">
              {def.tools.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-md border border-line bg-white/[0.02] px-1.5 py-0.5 font-mono text-[10px] text-mute">
                  <Wrench className="h-2.5 w-2.5 text-faint" /> {TOOL_LABEL[t] ?? t}
                </span>
              ))}
            </div>
            <Link href="/settings#permissions" className="text-[11px] text-faint hover:text-accent">
              Manage permissions →
            </Link>
          </div>
        </div>
      </header>

      {!perm.enabled && (
        <div className="mb-6 rounded-2xl border border-warn/25 bg-warn/[0.06] px-4 py-3 text-sm text-warn">
          This clone is paused. It won&apos;t read data or act until you re-enable it in{" "}
          <Link href="/settings#permissions" className="underline">
            Settings
          </Link>
          .
        </div>
      )}

      {summary && <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">{summary}</div>}

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="min-w-0 space-y-5 xl:col-span-7 2xl:col-span-8">{children}</div>

        <aside className="min-w-0 space-y-5 xl:col-span-5 2xl:col-span-4">
          <GlassPanel className="flex h-[640px] flex-col">
            <SectionHeader eyebrow="Command interface" title={consoleTitle ?? `Ask the ${def.short} clone`} />
            <AgentConsole clone={clone} className="min-h-0 flex-1" />
          </GlassPanel>

          <GlassPanel>
            <SectionHeader eyebrow="Shared calendar service" title="Availability as this clone sees it" />
            <CalendarSummary viewer={clone} days={[0, 1, 2]} />
          </GlassPanel>

          {pending.length > 0 && (
            <GlassPanel>
              <SectionHeader eyebrow="Human in the loop" title={`${pending.length} pending approval${pending.length > 1 ? "s" : ""}`} />
              <div className="space-y-3">
                {pending.map((a) => (
                  <ApprovalCard key={a.id} approval={a} compact />
                ))}
              </div>
            </GlassPanel>
          )}

          <GlassPanel>
            <SectionHeader eyebrow="Audit trail" title="Recent activity" />
            <ActivityTimeline entries={mine} limit={6} />
          </GlassPanel>
        </aside>
      </div>
    </div>
  );
}
