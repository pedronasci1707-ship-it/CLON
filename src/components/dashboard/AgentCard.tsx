"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { forwardRef, type CSSProperties } from "react";
import { CLONES } from "@/lib/clones";
import { spotlightHandlers } from "@/lib/hooks";
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
  const right = side === "right";
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
      aria-label={`${def.name}${snapshot ? ` — ${snapshot.metric.value} ${snapshot.metric.label}` : ""}`}
      title={def.tagline}
    >
      <div className="spotlight pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      {working && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden">
          <div className="h-full w-1/3 animate-[shimmer_1.4s_linear_infinite] bg-[linear-gradient(90deg,transparent,var(--accent),transparent)] bg-[length:200%_100%]" />
        </div>
      )}

      <div className={cn("relative flex items-center gap-3.5", right && "xl:flex-row-reverse xl:text-right")}>
        <CloneSigil clone={clone} active={working} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-[17px] font-medium tracking-tight text-ink">{def.short}</h3>
          {snapshot ? <StatusIndicator state={snapshot.state} /> : <span className="skeleton mt-1 block h-3 w-16 rounded" />}
        </div>
        <ArrowUpRight
          className={cn(
            "h-4 w-4 shrink-0 text-accent opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100",
            right ? "translate-x-1 xl:-scale-x-100" : "-translate-x-1",
          )}
        />
      </div>

      <div className={cn("relative mt-5 flex items-end gap-3", right && "xl:flex-row-reverse")}>
        {snapshot ? (
          <div className={cn("min-w-0", right && "xl:text-right")}>
            <div className="font-display text-[32px] font-medium leading-none tracking-tight text-accent [text-shadow:0_0_24px_color-mix(in_oklab,var(--accent)_45%,transparent)]">
              {snapshot.metric.value}
            </div>
            <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-faint">{snapshot.metric.label}</div>
          </div>
        ) : (
          <span className="skeleton block h-10 w-24 rounded-lg" />
        )}
        {!!snapshot?.pending && (
          <span
            className={cn("mb-0.5 grid h-6 min-w-6 place-items-center rounded-full border border-accent-soft bg-accent-soft px-1.5 font-mono text-[10px] text-accent", right ? "ml-auto xl:ml-0 xl:mr-auto" : "ml-auto")}
            title={`${snapshot.pending} awaiting approval`}
          >
            {snapshot.pending}
          </span>
        )}
      </div>
    </Link>
  );
});
