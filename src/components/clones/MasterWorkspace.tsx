"use client";

import Link from "next/link";
import { ArrowLeft, CalendarDays, Cpu, Globe, LoaderCircle, Mail, ShieldCheck, Sparkles, Target } from "lucide-react";
import { useMemo, type CSSProperties } from "react";
import { CLONES, SPECIALISTS } from "@/lib/clones";
import { useCalendar, useClock, usePendingApprovals } from "@/lib/hooks";
import { useClon } from "@/lib/store";
import { LOCALE, timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";
import { AgentConsole } from "@/components/agent/AgentConsole";
import { AUTONOMY_LABEL } from "@/components/agent/AgentWorkspace";
import { MasterHologram } from "@/components/hologram/MasterHologram";
import { Badge, ModeBadge } from "@/components/ui/Badge";
import { CloneSigil } from "@/components/ui/CloneSigil";
import { GlassPanel, SectionHeader } from "@/components/ui/GlassPanel";
import { StatusIndicator } from "@/components/ui/StatusIndicator";

const tf = (iso: string) => new Date(iso).toLocaleTimeString(LOCALE, { hour: "numeric", minute: "2-digit" });

export function MasterWorkspace() {
  const clock = useClock(60_000);
  const permissions = useClon((s) => s.permissions);
  const running = useClon((s) => s.running);
  const tasks = useClon((s) => s.tasks);
  const mode = useClon((s) => s.mode);
  const thread = useClon((s) => s.threads.master);
  const system = useClon((s) => s.system);
  const hydrated = useClon((s) => s.hydrated);
  const pending = usePendingApprovals();
  const cal = useCalendar("master", 0, 1);

  const priorities = useMemo(
    () =>
      (mode === "live" ? tasks.filter((t) => !t.demo) : tasks)
        .filter((t) => t.status !== "done")
        .sort((a, b) => a.priority.localeCompare(b.priority))
        .slice(0, 3),
    [tasks, mode],
  );
  const next = clock ? cal.events.find((e) => Date.parse(e.start) > clock.now) : undefined;
  const runs = thread.filter((m) => m.role === "assistant" && m.title).slice(-4).reverse();

  return (
    <div className="mx-auto max-w-[1560px]" style={{ "--accent": CLONES.master.accent } as CSSProperties}>
      <Link href="/" className="mb-5 inline-flex items-center gap-1.5 text-xs text-mute transition-colors hover:text-cyan">
        <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
      </Link>

      <div className="grid gap-5 xl:grid-cols-12">
        <GlassPanel className="flex h-[calc(100dvh-150px)] min-h-[620px] flex-col xl:col-span-8">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <CloneSigil clone="master" size={42} active={!!running} />
            <div>
              <h1 className="font-display text-xl font-medium tracking-tight text-ink">Master Clone · Command center</h1>
              <p className="text-xs text-mute">Describe an outcome. The Master delegates to specialists, resolves conflicts and asks before acting.</p>
            </div>
            <div className="ml-auto flex gap-1.5">
              {hydrated && <ModeBadge mode={mode} />}
              <Badge title="How commands are interpreted">
                {system?.llm.configured ? <Sparkles className="h-2.5 w-2.5" /> : <Cpu className="h-2.5 w-2.5" />}
                {system?.llm.configured ? system.llm.model : "Rules planner"}
              </Badge>
            </div>
          </div>
          <AgentConsole clone="master" className="min-h-0 flex-1" emptyTitle="What should your clone take care of?" />
        </GlassPanel>

        <aside className="space-y-5 xl:col-span-4">
          <GlassPanel className="relative overflow-hidden p-0" padded={false}>
            <MasterHologram compact className="h-[300px] w-full" showLabel />
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between border-t border-line bg-void/60 px-4 py-2.5 backdrop-blur">
              <StatusIndicator state={running ? "working" : "idle"} label={running ? running.label : "Master intelligence — ready"} />
              {running && <LoaderCircle className="h-3.5 w-3.5 animate-spin text-cyan" />}
            </div>
          </GlassPanel>

          <GlassPanel>
            <SectionHeader eyebrow="Connected clones" title="Specialists under coordination" />
            <ul className="space-y-1.5">
              {SPECIALISTS.map((id) => {
                const def = CLONES[id];
                const p = permissions[id];
                const working = running?.activeClones.includes(id);
                return (
                  <li key={id}>
                    <Link
                      href={`/clones/${id}`}
                      className="flex items-center gap-3 rounded-xl border border-line bg-white/[0.015] px-3 py-2 transition-colors hover:border-line-strong"
                      style={{ "--accent": def.accent } as CSSProperties}
                    >
                      <CloneSigil clone={id} size={30} active={working} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] text-ink">{def.short}</div>
                        <div className="truncate text-[11px] text-faint">
                          {AUTONOMY_LABEL[p.autonomy]} · calendar {p.calendar}
                        </div>
                      </div>
                      <StatusIndicator state={!p.enabled ? "disabled" : working ? "working" : pending.some((a) => a.clone === id) ? "attention" : "idle"} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </GlassPanel>

          <GlassPanel>
            <SectionHeader eyebrow="Current priorities" title="What matters next" />
            <ul className="space-y-2 text-[13px]">
              {next && (
                <li className="flex items-center gap-2.5">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0 text-cyan" />
                  <span className="truncate text-ink">{next.title}</span>
                  <span className="ml-auto shrink-0 font-mono text-[11px] text-mute">{tf(next.start)}</span>
                </li>
              )}
              {priorities.map((t) => (
                <li key={t.id} className="flex items-center gap-2.5">
                  <Target className="h-3.5 w-3.5 shrink-0 text-work" />
                  <span className="truncate text-soft">{t.title}</span>
                  <span className="ml-auto shrink-0 font-mono text-[10px] uppercase text-faint">{t.priority}</span>
                </li>
              ))}
              {pending.length > 0 && (
                <li>
                  <Link href="/approvals" className="flex items-center gap-2.5 text-cyan hover:underline">
                    <ShieldCheck className="h-3.5 w-3.5" /> {pending.length} action{pending.length > 1 ? "s" : ""} awaiting approval
                  </Link>
                </li>
              )}
              {!next && priorities.length === 0 && pending.length === 0 && <li className="text-xs text-mute">Nothing urgent.</li>}
            </ul>
          </GlassPanel>

          <GlassPanel>
            <SectionHeader eyebrow="Workflows" title="Active and recent" />
            {running && (
              <div className="mb-2 flex items-center gap-2 rounded-xl border border-cyan/25 bg-cyan/[0.06] px-3 py-2 text-xs text-cyan">
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> {running.label}
              </div>
            )}
            {runs.length === 0 && !running ? (
              <p className="text-xs text-mute">No workflows yet. Try “Help me organize tomorrow”.</p>
            ) : (
              <ul className="space-y-1.5">
                {runs.map((r) => (
                  <li key={r.id} className="flex items-center gap-2 text-xs">
                    <span
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        r.status === "done" ? "bg-ok" : r.status === "error" ? "bg-danger" : r.status === "needs_input" ? "bg-warn" : "bg-cyan",
                      )}
                    />
                    <span className="truncate text-soft">{r.title}</span>
                    <span className="ml-auto flex shrink-0 gap-0.5">
                      {(r.clones ?? []).filter((c) => c !== "master").map((c) => (
                        <span key={c} className="h-1.5 w-1.5 rounded-full" style={{ background: CLONES[c].accent }} />
                      ))}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-faint">{timeAgo(r.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </GlassPanel>

          <GlassPanel>
            <SectionHeader eyebrow="Shared services" title="Capabilities every clone can use" />
            <ul className="space-y-2 text-xs">
              <Service icon={CalendarDays} name="Shared calendar service" detail="getEvents · checkAvailability · suggestTimeSlots · createEvent* · updateEvent*" state={system?.composio.accounts.googlecalendar} />
              <Service icon={Mail} name="Gmail" detail="read · create draft (never sends)" state={system?.composio.accounts.gmail} />
              <Service icon={Globe} name="Parallel web research" detail="live events with source links" state={system?.parallel.configured ? "connected" : "not_connected"} />
              <Service icon={ShieldCheck} name="Approvals & audit" detail="signed proposals · human approval · activity log" state="builtin" />
            </ul>
            <p className="mt-2.5 text-[11px] text-faint">* requires your approval. In Demo mode every service runs against seeded data.</p>
          </GlassPanel>
        </aside>
      </div>
    </div>
  );
}

function Service({
  icon: Icon,
  name,
  detail,
  state,
}: {
  icon: React.ComponentType<{ className?: string }>;
  name: string;
  detail: string;
  state?: string;
}) {
  return (
    <li className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan" />
      <div className="min-w-0 flex-1">
        <div className="text-soft">{name}</div>
        <div className="font-mono text-[10px] text-faint">{detail}</div>
      </div>
      {state === "builtin" ? <Badge tone="cyan">Built in</Badge> : state === "connected" ? <Badge tone="ok">Connected</Badge> : <Badge>Not connected</Badge>}
    </li>
  );
}
