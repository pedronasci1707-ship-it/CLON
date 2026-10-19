"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ArrowUpRight, Maximize2, ShieldCheck, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AgentConsole } from "@/components/agent/AgentConsole";
import { CommandBar } from "@/components/agent/CommandBar";
import { ActivityTimeline } from "@/components/activity/ActivityTimeline";
import { ApprovalCard } from "@/components/approvals/ApprovalCard";
import { CalendarSummary } from "@/components/calendar/CalendarSummary";
import { MasterHologram } from "@/components/hologram/MasterHologram";
import { CloneSigil } from "@/components/ui/CloneSigil";
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
        className="relative grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-[minmax(250px,1fr)_minmax(440px,1.35fr)_minmax(250px,1fr)] xl:gap-10"
        aria-label="Your clones"
      >
        <ConnectionLines container={stageRef} core={coreRef} cards={cardRefs} />

        <div className="relative z-10 order-2 flex flex-col justify-center gap-5 md:order-2 xl:order-1">
          {LEFT.map((id) => (
            <AgentCard key={id} clone={id} snapshot={insights?.[id] ?? null} side="left" ref={(el) => void (cardRefs.current[id] = el)} />
          ))}
        </div>

        <div className="relative z-10 order-1 flex flex-col items-center md:col-span-2 xl:order-2 xl:col-span-1">
          <div ref={coreRef} className="relative h-[320px] w-full max-w-[560px] sm:h-[400px] xl:h-[clamp(340px,52vh,470px)]">
            <MasterHologram className="h-full w-full" onActivate={() => router.push("/clones/master")} />
          </div>

          <h1 className="-mt-3 text-center font-display text-[28px] font-medium leading-tight tracking-tight sm:text-[34px]">
            <span className="text-gradient">{hydrated ? `Ready, ${firstName}.` : "Ready."}</span>
          </h1>

          <CommandBar clone="master" size="lg" hotkey className="mt-6 max-w-[640px]" onSubmitted={() => setConsoleOpen(true)} />

          {thread.length > 0 && !consoleOpen && (
            <button
              onClick={() => setConsoleOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-mute transition-colors hover:text-cyan"
            >
              Last result <ArrowRight className="h-3 w-3" />
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
      <section className="mt-12 grid gap-5 lg:grid-cols-3" aria-label="Activity and schedule">
        <GlassPanel>
          <SectionHeader title="Today" />
          <CalendarSummary viewer="master" days={[0, 1]} />
        </GlassPanel>

        <GlassPanel>
          <SectionHeader title="Approvals" count={pending.length} action={<MoreLink href="/approvals" label="All approvals" />} />
          {pending.length ? (
            <div className="space-y-3">
              {pending.slice(0, 2).map((a) => (
                <ApprovalCard key={a.id} approval={a} compact />
              ))}
            </div>
          ) : (
            <EmptyState icon={ShieldCheck} title="All clear" />
          )}
        </GlassPanel>

        <GlassPanel>
          <SectionHeader title="Activity" action={<MoreLink href="/activity" label="Full history" />} />
          {hydrated ? <ActivityTimeline entries={activity} limit={6} /> : <div className="skeleton h-64 rounded-xl" />}
        </GlassPanel>
      </section>

      <ConsoleSheet open={consoleOpen} onClose={() => setConsoleOpen(false)} />
    </div>
  );
}

function MoreLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="grid h-7 w-7 place-items-center rounded-lg text-faint transition-colors hover:bg-white/5 hover:text-cyan"
      aria-label={label}
      title={label}
    >
      <ArrowUpRight className="h-3.5 w-3.5" />
    </Link>
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
          <div className="mb-4 flex items-center gap-3">
            <CloneSigil clone="master" size={30} />
            <div className="font-mono text-[10.5px] uppercase tracking-[0.24em] text-mute">Master</div>
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
