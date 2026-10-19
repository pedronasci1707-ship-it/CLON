"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { forwardRef, type CSSProperties } from "react";
import { CLONES } from "@/lib/clones";
import { spotlightHandlers } from "@/lib/hooks";
import { timeAgo } from "@/lib/time";
import type { SpecialistId } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CloneSigil } from "@/components/ui/CloneSigil";
import { StatusIndicator } from "@/components/ui/StatusIndicator";
import type { CloneSnapshot } from "./useCloneInsights";

interface AgentCardProps {
  clone: SpecialistId;
  snapshot: CloneSnapshot | null;
  side?: "left" | "right";
}

export const AgentCard = forwardRef<HTMLAnchorElement, AgentCardProps>(function AgentCard({ clone, snapshot, side = "left" }, ref) {
  const def = CLONES[clone];
  const working = snapshot?.state === "working";
  return (
    <Link
      ref={ref}
      href={`/clones/${clone}`}
      {...spotlightHandlers()}
      className={cn(
        "glass glass-rim glass-interactive group relative block overflow-hidden rounded-panel p-5 hover:-translate-y-0.5",
        working && "ring-accent",
      )}
      style={{ "--accent": def.accent } as CSSProperties}
      aria-label={`${def.name} — open workspace`}
    >
      <div className="spotlight pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      {working && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden">
          <div className="h-full w-1/3 animate-[shimmer_1.4s_linear_infinite] bg-[linear-gradient(90deg,transparent,var(--accent),transparent)] bg-[length:200%_100%]" />
        </div>
      )}

      <div className={cn("relative flex items-start gap-3.5", side === "right" && "xl:flex-row-reverse xl:text-right")}>
        <CloneSigil clone={clone} active={working} />
        <div className="min-w-0 flex-1">
          <div className={cn("flex items-center gap-2", side === "right" && "xl:flex-row-reverse")}>
            <h3 className="truncate font-display text-[17px] font-medium tracking-tight text-ink">{def.short}</h3>
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-faint">clone</span>
            <ArrowUpRight
              className={cn(
                "h-4 w-4 text-accent opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100",
                side === "right" ? "xl:mr-auto -translate-x-1" : "ml-auto -translate-x-1",
              )}
            />
          </div>
          <div className="mt-1">
            {snapshot ? <StatusIndicator state={snapshot.state} /> : <span className="skeleton block h-3 w-20 rounded" />}
          </div>
        </div>
      </div>

      <ul className="relative mt-4 space-y-1.5">
        {snapshot
          ? snapshot.insights.map((ins, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="truncate text-soft/90">{ins.label}</span>
                {ins.value && <span className="shrink-0 font-mono text-[12px] text-accent">{ins.value}</span>}
              </li>
            ))
          : [0, 1, 2].map((i) => <li key={i} className="skeleton h-4 rounded" style={{ width: `${88 - i * 12}%` }} />)}
      </ul>

      <div className="relative mt-4 flex items-center gap-2 border-t border-line pt-3">
        <span
          className={cn(
            "inline-flex h-[22px] items-center gap-1.5 rounded-full border px-2 font-mono text-[10px] uppercase tracking-[0.12em]",
            snapshot && snapshot.pending > 0 ? "border-accent-soft bg-accent-soft text-accent" : "border-line text-faint",
          )}
        >
          {snapshot?.pending ?? 0} pending
        </span>
        <span className="min-w-0 flex-1 truncate text-right text-[11px] text-mute" title={snapshot?.latest?.action}>
          {snapshot?.latest ? (
            <>
              <span className="text-faint">{timeAgo(snapshot.latest.at)} · </span>
              {snapshot.latest.action}
            </>
          ) : (
            "No activity yet"
          )}
        </span>
      </div>
    </Link>
  );
});
