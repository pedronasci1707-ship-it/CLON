"use client";

import { motion } from "motion/react";
import { History } from "lucide-react";
import { CLONES } from "@/lib/clones";
import { timeAgo } from "@/lib/time";
import type { ActivityEntry } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge, OutcomeBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/States";

const SERVICE_LABEL: Record<ActivityEntry["service"], string> = {
  calendar: "Calendar",
  gmail: "Gmail",
  parallel: "Parallel",
  llm: "Model",
  local: "On device",
  system: "System",
};

/** The unified, cross-clone view of what CLON has done. */
export function ActivityTimeline({
  entries,
  limit,
  showDetail = false,
  className,
}: {
  entries: ActivityEntry[];
  limit?: number;
  showDetail?: boolean;
  className?: string;
}) {
  const list = limit ? entries.slice(0, limit) : entries;
  if (!list.length) {
    return <EmptyState icon={History} title="Nothing yet" body="Actions taken by any clone will appear here, with their source and outcome." />;
  }
  return (
    <ol className={cn("relative", className)}>
      <span className="absolute bottom-3 left-[7px] top-3 w-px bg-[linear-gradient(180deg,transparent,var(--color-line-strong),transparent)]" aria-hidden />
      {list.map((e, i) => {
        const def = CLONES[e.clone];
        return (
          <motion.li
            key={e.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i, 8) * 0.04, duration: 0.35 }}
            className="relative flex gap-4 py-2.5 pl-0"
          >
            <span className="relative z-10 mt-1.5 grid h-[15px] w-[15px] shrink-0 place-items-center rounded-full bg-void">
              <span className="h-[7px] w-[7px] rounded-full" style={{ background: def.accent, boxShadow: `0 0 10px ${def.accent}` }} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-[11px] font-medium" style={{ color: def.accent }}>
                  {def.short}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
                  {SERVICE_LABEL[e.service]} · {timeAgo(e.at)}
                </span>
              </div>
              <p className="mt-0.5 text-[13px] leading-snug text-soft">{e.action}</p>
              {showDetail && e.detail && <p className="mt-1 break-words text-xs text-mute">{e.detail}</p>}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
              <OutcomeBadge outcome={e.outcome} />
              {showDetail && <Badge tone={e.mode === "live" ? "ok" : "violet"}>{e.mode}</Badge>}
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}
