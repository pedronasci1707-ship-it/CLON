"use client";

import { motion } from "motion/react";
import { History } from "lucide-react";
import { CLONES } from "@/lib/clones";
import { timeAgo } from "@/lib/time";
import type { ActivityEntry } from "@/lib/types";
import { cn } from "@/lib/utils";
import { OutcomeIcon } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/States";

const SERVICE_LABEL: Record<ActivityEntry["service"], string> = {
  calendar: "Calendar",
  gmail: "Gmail",
  parallel: "Parallel",
  llm: "Model",
  local: "On device",
  system: "System",
};

/** The unified, cross-clone view of what CLON has done — one line per action, details on hover. */
export function ActivityTimeline({ entries, limit, className }: { entries: ActivityEntry[]; limit?: number; className?: string }) {
  const list = limit ? entries.slice(0, limit) : entries;
  if (!list.length) {
    return <EmptyState icon={History} title="Nothing yet" />;
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
            title={[def.short, SERVICE_LABEL[e.service], e.mode, e.detail].filter(Boolean).join(" · ")}
            className="relative flex items-center gap-4 py-2"
          >
            <span className="relative z-10 grid h-[15px] w-[15px] shrink-0 place-items-center rounded-full bg-void">
              <span className="h-[7px] w-[7px] rounded-full" style={{ background: def.accent, boxShadow: `0 0 10px ${def.accent}` }} />
            </span>
            <p className="min-w-0 flex-1 truncate text-[13px] text-soft">{e.action}</p>
            <span className="shrink-0 font-mono text-[10px] text-faint">{timeAgo(e.at)}</span>
            <OutcomeIcon outcome={e.outcome} />
          </motion.li>
        );
      })}
    </ol>
  );
}
