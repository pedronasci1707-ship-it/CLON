"use client";

import { motion } from "motion/react";
import { Cpu, RotateCcw, Sparkles } from "lucide-react";
import { useEffect, useRef, type CSSProperties } from "react";
import { CLONES } from "@/lib/clones";
import { useClon } from "@/lib/store";
import type { CloneId, ThreadMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ModeBadge } from "@/components/ui/Badge";
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
}

export function AgentConsole({ clone, className, scroll = true, showComposer = true }: AgentConsoleProps) {
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
          <div className="grid h-full min-h-40 place-items-center" title={def.mission}>
            <CloneSigil clone={clone} size={56} />
          </div>
        )}
        {thread.map((m) => (m.role === "user" ? <UserBubble key={m.id} m={m} /> : <AssistantBlock key={m.id} m={m} clone={clone} />))}
        <div ref={endRef} />
      </div>

      {showComposer && (
        <div className="mt-4 flex shrink-0 flex-col">
          <CommandBar clone={clone} hideChips={thread.length > 0} />
          {thread.length > 0 && !running && (
            <button
              onClick={() => clearThread(clone)}
              className="mt-1.5 grid h-7 w-7 place-items-center self-end rounded-lg text-faint transition-colors hover:bg-white/5 hover:text-mute"
              aria-label="Clear conversation"
              title="Clear conversation"
            >
              <RotateCcw className="h-3.5 w-3.5" />
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
              <span
                className="text-faint"
                title={m.planner === "llm" ? "Intent parsed by your configured model" : "Intent parsed by the deterministic rules planner"}
              >
                {m.planner === "llm" ? <Sparkles className="h-3 w-3" /> : <Cpu className="h-3 w-3" />}
              </span>
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
          <span className="flex gap-1" role="status" aria-label="Interpreting your request">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-accent" style={{ animationDelay: `${i * 0.18}s` }} />
            ))}
          </span>
        )}
      </div>
    </motion.div>
  );
}
