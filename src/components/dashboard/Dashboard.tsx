"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Maximize2, ShieldCheck, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AgentConsole } from "@/components/agent/AgentConsole";
import { CommandBar } from "@/components/agent/CommandBar";
import { ActivityTimeline } from "@/components/activity/ActivityTimeline";
import { ApprovalCard } from "@/components/approvals/ApprovalCard";
import { CalendarSummary } from "@/components/calendar/CalendarSummary";
import { MasterHologram } from "@/components/hologram/MasterHologram";
import { GlassPanel, SectionHeader } from "@/components/ui/GlassPanel";
import { EmptyState } from "@/components/ui/States";
import { usePendingApprovals } from "@/lib/hooks";
import { useClon } from "@/lib/store";
import type { SpecialistId } from "@/lib/types";
import { AgentCard } from "./AgentCard";
import { ConnectionLines } from "./ConnectionLines";
import { useCloneInsights } from "./useCloneInsights";

const LEFT: SpecialistId[] = ["communication", "work"];
const RIGHT: SpecialistId[] = ["life", "fitness"];

export function Dashboard() {
  const router = useRouter();
  const insights = useCloneInsights();
  const activity = useClon((s) => s.activity);
  const profile = useClon((s) => s.profile);
  const hydrated = useClon((s) => s.hydrated);
  const running = useClon((s) => s.running);
  const thread = useClon((s) => s.threads.master);
  const pending = usePendingApprovals();
  const [consoleOpen, setConsoleOpen] = useState(false);

  const stageRef = useRef<HTMLElement>(null);
  const coreRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Partial<Record<SpecialistId, HTMLElement | null>>>({});

  // Re-open the live console whenever the Master starts working from here.
  useEffect(() => {
    if (running?.clone === "master") setConsoleOpen(true);
  }, [running?.clone]);

  const firstName = profile.name.split(" ")[0];

  return (
    <div className="mx-auto max-w-[1560px]">
      {/* ───────────── Mission stage ───────────── */}
      <section
        ref={stageRef}
        className="relative grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-[minmax(270px,1fr)_minmax(440px,1.35fr)_minmax(270px,1fr)] xl:gap-8"
        aria-label="Your clones"
      >
        <ConnectionLines container={stageRef} core={coreRef} cards={cardRefs} />

        <div className="relative z-10 order-2 flex flex-col justify-center gap-5 md:order-2 xl:order-1">
          {LEFT.map((id) => (
            <AgentCard key={id} clone={id} snapshot={insights?.[id] ?? null} side="left" ref={(el) => void (cardRefs.current[id] = el)} />
          ))}
        </div>

        <div className="relative z-10 order-1 flex flex-col items-center md:col-span-2 xl:order-2 xl:col-span-1">
          <div className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-faint">
            <span className="h-px w-8 bg-[linear-gradient(90deg,transparent,#5be7f5)]" />
            Master clone
            <span className="h-px w-8 bg-[linear-gradient(90deg,#5be7f5,transparent)]" />
          </div>

          <div ref={coreRef} className="relative h-[340px] w-full max-w-[560px] sm:h-[420px] xl:h-[clamp(360px,54vh,490px)]">
            <MasterHologram className="h-full w-full" onActivate={() => router.push("/clones/master")} />
          </div>

          <div className="-mt-4 w-full max-w-[640px] text-center">
            <h1 className="font-display text-[26px] font-medium leading-tight tracking-tight sm:text-[32px]">
              <span className="text-gradient">{hydrated ? `Your clone is ready, ${firstName}.` : "Your clone is ready."}</span>
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-mute">
              One intelligence, four specialists, your rules. Tell it what you want — it coordinates the rest and asks before acting.
            </p>
          </div>

          <CommandBar clone="master" size="lg" hotkey className="mt-6 max-w-[680px]" onSubmitted={() => setConsoleOpen(true)} />

          {thread.length > 0 && !consoleOpen && (
            <button
              onClick={() => setConsoleOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 text-xs text-mute transition-colors hover:text-cyan"
            >
              Show last result <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="relative z-10 order-3 flex flex-col justify-center gap-5">
          {RIGHT.map((id) => (
            <AgentCard key={id} clone={id} snapshot={insights?.[id] ?? null} side="right" ref={(el) => void (cardRefs.current[id] = el)} />
          ))}
        </div>
      </section>

      {/* ───────────── Unified life view ───────────── */}
      <section className="mt-10 grid gap-5 lg:grid-cols-12" aria-label="Activity and schedule">
        <GlassPanel className="lg:col-span-7">
          <SectionHeader
            eyebrow="Unified timeline"
            title="What your clones have been doing"
            action={
              <Link href="/activity" className="inline-flex items-center gap-1 text-xs text-mute hover:text-cyan">
                Full history <ArrowRight className="h-3 w-3" />
              </Link>
            }
          />
          {hydrated ? <ActivityTimeline entries={activity} limit={6} /> : <div className="skeleton h-64 rounded-xl" />}
        </GlassPanel>

        <div className="flex flex-col gap-5 lg:col-span-5">
          <GlassPanel>
            <SectionHeader
              eyebrow="Human in the loop"
              title={pending.length ? `${pending.length} awaiting your approval` : "Approvals"}
              action={
                <Link href="/approvals" className="inline-flex items-center gap-1 text-xs text-mute hover:text-cyan">
                  All <ArrowRight className="h-3 w-3" />
                </Link>
              }
            />
            {pending.length ? (
              <div className="space-y-3">
                {pending.slice(0, 2).map((a) => (
                  <ApprovalCard key={a.id} approval={a} compact />
                ))}
              </div>
            ) : (
              <EmptyState icon={ShieldCheck} title="You're all caught up" body="Anything that changes your calendar or reaches other people will wait here for you." />
            )}
          </GlassPanel>

          <GlassPanel>
            <SectionHeader eyebrow="Shared calendar" title="Your availability" />
            <CalendarSummary viewer="master" days={[0, 1]} />
          </GlassPanel>
        </div>
      </section>

      <ConsoleSheet open={consoleOpen} onClose={() => setConsoleOpen(false)} />
    </div>
  );
}

function ConsoleSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ x: "105%", opacity: 0.6 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "105%", opacity: 0.6 }}
          transition={{ type: "spring", stiffness: 260, damping: 32 }}
          className="glass fixed bottom-3 right-3 top-3 z-40 flex w-[min(540px,calc(100vw-1.5rem))] flex-col rounded-[24px] bg-abyss/95 p-4 shadow-[0_30px_120px_-20px_rgb(0_0_0/0.9),0_0_0_1px_rgb(91_231_245/0.08)] backdrop-blur-2xl sm:p-5"
          aria-label="Master Clone console"
        >
          <div className="mb-4 flex items-center gap-2">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-faint">Live console</div>
              <div className="font-display text-[15px] text-ink">Master Clone</div>
            </div>
            <Link
              href="/clones/master"
              className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-mute hover:bg-white/5 hover:text-ink"
              aria-label="Open full command center"
              title="Open full command center"
            >
              <Maximize2 className="h-4 w-4" />
            </Link>
            <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-mute hover:bg-white/5 hover:text-ink" aria-label="Close console">
              <X className="h-4 w-4" />
            </button>
          </div>
          <AgentConsole clone="master" className="min-h-0 flex-1" />
        </motion.aside>
      )}
    </AnimatePresence>,
    document.body,
  );
}
