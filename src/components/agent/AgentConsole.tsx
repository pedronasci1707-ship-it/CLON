"use client";

import { motion } from "motion/react";
import { Cpu, RotateCcw, Sparkles } from "lucide-react";
import { useEffect, useRef, type CSSProperties } from "react";
import { CLONES } from "@/lib/clones";
import { useClon } from "@/lib/store";
import type { CloneId, ThreadMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge, ModeBadge } from "@/components/ui/Badge";
import { CloneSigil } from "@/components/ui/CloneSigil";
import { ArtifactView } from "./ArtifactView";
import { CommandBar } from "./CommandBar";
import { WorkflowProgress } from "./WorkflowProgress";

interface AgentConsoleProps {
  clone: CloneId;
  className?: string;
  /** Height-constrained scrolling thread (for sidebars and sheets). */
  scroll?: boolean;
  showComposer?: boolean;
  emptyTitle?: string;
}

export function AgentConsole({ clone, className, scroll = true, showComposer = true, emptyTitle }: AgentConsoleProps) {
  const def = CLONES[clone];
  const thread = useClon((s) => s.threads[clone]);
  const clearThread = useClon((s) => s.clearThread);
  const hydrated = useClon((s) => s.hydrated);
  const running = useClon((s) => s.running);
  const endRef = useRef<HTMLDivElement>(null);
  const last = thread[thread.length - 1];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [thread.length, last?.steps?.length, last?.artifacts?.length, last?.text]);

  return (
    <div className={cn("@container flex min-h-0 flex-col", className)} style={{ "--accent": def.accent } as CSSProperties}>
      <div className={cn("min-h-0 flex-1 space-y-5", scroll && "overflow-y-auto pr-1")}>
        {hydrated && thread.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <CloneSigil clone={clone} size={52} />
            <div>
              <div className="font-display text-base text-ink">{emptyTitle ?? `Talk to your ${def.short} clone`}</div>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-mute">{def.mission}</p>
            </div>
          </div>
        )}
        {thread.map((m) => (m.role === "user" ? <UserBubble key={m.id} m={m} /> : <AssistantBlock key={m.id} m={m} clone={clone} />))}
        <div ref={endRef} />
      </div>

      {showComposer && (
        <div className="mt-4 shrink-0">
          <CommandBar clone={clone} hideChips={thread.length > 0} />
          {thread.length > 0 && !running && (
            <button
              onClick={() => clearThread(clone)}
              className="mt-2 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-faint hover:text-mute"
            >
              <RotateCcw className="h-3 w-3" /> Clear conversation
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function UserBubble({ m }: { m: ThreadMessage }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-md border border-line-strong bg-white/[0.05] px-3.5 py-2.5 text-[13.5px] leading-relaxed text-ink">
        {m.text}
      </div>
    </motion.div>
  );
}

function AssistantBlock({ m, clone }: { m: ThreadMessage; clone: CloneId }) {
  const lead: CloneId = m.clones?.find((c) => c !== "master") && clone !== "master" ? clone : "master";
  const delegated = (m.clones ?? []).filter((c) => c !== "master");
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
      <CloneSigil clone={lead} size={30} active={m.status === "running"} className="mt-0.5" />
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] font-medium text-ink">{m.title ?? (m.status === "running" ? "Interpreting…" : CLONES[lead].name)}</span>
          {delegated.length > 0 && (
            <span className="flex items-center gap-1">
              {delegated.map((c) => (
                <span key={c} className="h-1.5 w-1.5 rounded-full" style={{ background: CLONES[c].accent }} title={CLONES[c].name} />
              ))}
            </span>
          )}
          <span className="ml-auto flex items-center gap-1.5">
            {m.planner && (
              <Badge title={m.planner === "llm" ? "Intent parsed by your configured model" : "Intent parsed by the deterministic rules planner"}>
                {m.planner === "llm" ? <Sparkles className="h-2.5 w-2.5" /> : <Cpu className="h-2.5 w-2.5" />}
                {m.planner === "llm" ? "model" : "rules"}
              </Badge>
            )}
            {m.mode && <ModeBadge mode={m.mode} />}
          </span>
        </div>

        {!!m.steps?.length && (
          <div className="rounded-2xl border border-line bg-void/30 p-1.5">
            <WorkflowProgress steps={m.steps} />
          </div>
        )}

        {m.artifacts?.map((a) => <ArtifactView key={a.id} artifact={a} clone={clone} />)}

        {m.text && (
          <p className={cn("whitespace-pre-line text-[13.5px] leading-relaxed", m.status === "error" ? "text-danger" : "text-soft")}>{m.text}</p>
        )}
        {m.status === "running" && !m.steps?.length && (
          <div className="flex items-center gap-2 text-xs text-mute">
            <span className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-accent" style={{ animationDelay: `${i * 0.18}s` }} />
              ))}
            </span>
            Interpreting your request…
          </div>
        )}
      </div>
    </motion.div>
  );
}
