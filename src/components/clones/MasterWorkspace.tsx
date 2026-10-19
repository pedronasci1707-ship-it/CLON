"use client";

import Link from "next/link";
import { CalendarDays, Cpu, LoaderCircle, ShieldCheck, Sparkles, Target } from "lucide-react";
import { useMemo, type CSSProperties } from "react";
import { CLONES, SPECIALISTS } from "@/lib/clones";
import { useCalendar, useClock, usePendingApprovals } from "@/lib/hooks";
import { useClon } from "@/lib/store";
import { LOCALE, timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";
import { AgentConsole } from "@/components/agent/AgentConsole";
import { MasterHologram } from "@/components/hologram/MasterHologram";
import { ModeBadge } from "@/components/ui/Badge";
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
      <div className="grid gap-5 xl:grid-cols-12">
        <GlassPanel className="flex h-[calc(100dvh-140px)] min-h-[620px] flex-col xl:col-span-8">
          <div className="mb-4 flex items-center gap-3">
            <CloneSigil clone="master" size={42} active={!!running} />
            <h1 className="font-display text-2xl font-medium tracking-tight text-ink" title={CLONES.master.mission}>
              Master
            </h1>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-faint" title={system?.llm.configured ? `Model · ${system.llm.model}` : "Rules planner"}>
                {system?.llm.configured ? <Sparkles className="h-3.5 w-3.5" /> : <Cpu className="h-3.5 w-3.5" />}
              </span>
              {hydrated && <ModeBadge mode={mode} />}
            </div>
          </div>
          <AgentConsole clone="master" className="min-h-0 flex-1" />
        </GlassPanel>

        <aside className="space-y-5 xl:col-span-4">
          <GlassPanel className="relative overflow-hidden p-0" padded={false}>
            <MasterHologram compact className="h-[280px] w-full" showLabel />
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-4 py-2.5">
              <StatusIndicator state={running ? "working" : "idle"} label={running ? running.label : undefined} />
              {running && <LoaderCircle className="h-3.5 w-3.5 animate-spin text-cyan" />}
            </div>
          </GlassPanel>

          <GlassPanel>
            <SectionHeader title="Clones" />
            <ul className="grid grid-cols-2 gap-2">
              {SPECIALISTS.map((id) => {
                const def = CLONES[id];
                const p = permissions[id];
                const working = running?.activeClones.includes(id);
                return (
                  <li key={id}>
                    <Link
                      href={`/clones/${id}`}
                      className="flex items-center gap-2.5 rounded-xl border border-line bg-white/[0.015] px-2.5 py-2 transition-colors hover:border-line-strong"
                      style={{ "--accent": def.accent } as CSSProperties}
                    >
                      <CloneSigil clone={id} size={28} active={working} />
                      <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{def.short}</span>
                      <StatusIndicator
                        state={!p.enabled ? "disabled" : working ? "working" : pending.some((a) => a.clone === id) ? "attention" : "idle"}
                        label=""
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </GlassPanel>

          <GlassPanel>
            <SectionHeader title="Next" />
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
                    <ShieldCheck className="h-3.5 w-3.5" /> {pending.length} to approve
                  </Link>
                </li>
              )}
              {!next && priorities.length === 0 && pending.length === 0 && (
                <li className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">All clear</li>
              )}
            </ul>
          </GlassPanel>

          <GlassPanel>
            <SectionHeader title="Runs" />
            {running && (
              <div className="mb-2 flex items-center gap-2 rounded-xl border border-cyan/25 bg-cyan/[0.06] px-3 py-2 text-xs text-cyan">
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> {running.label}
              </div>
            )}
            {runs.length === 0 && !running ? (
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">None yet</p>
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
        </aside>
      </div>
    </div>
  );
}
