"use client";

import { AnimatePresence, motion } from "motion/react";
import { Ban, Check, LoaderCircle, MinusCircle, X } from "lucide-react";
import { CLONES } from "@/lib/clones";
import type { WorkflowStep } from "@/lib/types";
import { cn } from "@/lib/utils";

const SERVICE: Record<string, string> = {
  calendar: "calendar",
  gmail: "gmail",
  parallel: "parallel",
  llm: "model",
  local: "on-device",
  system: "system",
};

function duration(s: WorkflowStep) {
  if (!s.endedAt) return null;
  const ms = Date.parse(s.endedAt) - Date.parse(s.startedAt);
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

/** Live, step-by-step view of which clone is doing what, through which service. */
export function WorkflowProgress({ steps }: { steps: WorkflowStep[] }) {
  if (!steps.length) return null;
  return (
    <ol className="relative space-y-1">
      <AnimatePresence initial={false}>
        {steps.map((s) => {
          const def = CLONES[s.clone];
          return (
            <motion.li
              key={s.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 text-[12.5px]"
            >
              <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center">
                {s.status === "running" ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" style={{ color: def.accent }} />
                ) : s.status === "done" ? (
                  <Check className="h-3.5 w-3.5 text-ok" strokeWidth={2.4} />
                ) : s.status === "error" ? (
                  <X className="h-3.5 w-3.5 text-danger" strokeWidth={2.4} />
                ) : s.status === "blocked" ? (
                  <Ban className="h-3.5 w-3.5 text-warn" />
                ) : (
                  <MinusCircle className="h-3.5 w-3.5 text-faint" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium" style={{ color: def.accent }}>
                    {def.short}
                  </span>
                  <span className={cn("text-soft", s.status === "running" && "text-ink")}>{s.label}</span>
                  {s.service && (
                    <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">via {SERVICE[s.service]}</span>
                  )}
                  {duration(s) && <span className="ml-auto font-mono text-[9.5px] text-faint">{duration(s)}</span>}
                </div>
                {s.detail && (
                  <p className={cn("mt-0.5 text-[11.5px] leading-snug", s.status === "error" ? "text-danger/90" : s.status === "blocked" ? "text-warn/90" : "text-mute")}>
                    {s.detail}
                  </p>
                )}
              </div>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ol>
  );
}
