"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Bell, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useClock, usePendingApprovals } from "@/lib/hooks";
import { useClon } from "@/lib/store";
import { LOCALE, timeAgo } from "@/lib/time";
import type { Mode } from "@/lib/types";
import { cn } from "@/lib/utils";
import { LogoMark, Wordmark } from "./Logo";

export function TopBar() {
  return (
    <header className="sticky top-0 z-20 bg-void/40 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 xl:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="CLON home">
          <LogoMark className="h-7 w-7 lg:hidden" />
          <Wordmark className="text-[15px]" />
        </Link>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <SystemClock />
          <ModeSwitch />
          <Notifications />
        </div>
      </div>
    </header>
  );
}

/** Time plus one status light; the system details are in its tooltip. */
function SystemClock() {
  const clock = useClock(15_000);
  const running = useClon((s) => s.running);
  const permissions = useClon((s) => s.permissions);
  const system = useClon((s) => s.system);
  const hydrated = useClon((s) => s.hydrated);
  const online = Object.values(permissions).filter((p) => p.enabled).length;
  const now = clock ? new Date(clock.now) : null;

  const detail = [
    running ? `Orchestrating · ${running.label}` : "System nominal",
    hydrated ? `${online}/4 clones online` : null,
    system?.llm.configured ? `LLM · ${system.llm.model}` : "Rules planner",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="hidden items-center gap-2.5 pr-1 font-mono text-[11px] tracking-[0.14em] text-mute sm:flex" title={detail}>
      <span className="relative flex h-2 w-2">
        <span className={cn("absolute inset-0 animate-ping rounded-full opacity-60", running ? "bg-cyan" : "bg-ok")} />
        <span className={cn("relative h-2 w-2 rounded-full", running ? "bg-cyan" : "bg-ok")} />
      </span>
      <span suppressHydrationWarning>{now ? now.toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" }) : " "}</span>
    </div>
  );
}

function ModeSwitch() {
  const mode = useClon((s) => s.mode);
  const setMode = useClon((s) => s.setMode);
  const system = useClon((s) => s.system);
  const notify = useClon((s) => s.notify);
  const hydrated = useClon((s) => s.hydrated);
  const router = useRouter();

  const choose = (m: Mode) => {
    if (m === "live" && !system?.liveAvailable) {
      notify({
        kind: "error",
        title: "Connect an app first",
        body: "Live mode needs Google Calendar or Gmail connected.",
        href: "/integrations",
      });
      router.push("/integrations");
      return;
    }
    setMode(m);
  };

  return (
    <div className="flex h-9 items-center rounded-xl border border-line bg-white/[0.02] p-0.5 font-mono text-[10px] uppercase tracking-[0.14em]" role="radiogroup" aria-label="Data mode">
      {(["demo", "live"] as Mode[]).map((m) => {
        const active = hydrated && mode === m;
        return (
          <button
            key={m}
            role="radio"
            aria-checked={active}
            onClick={() => choose(m)}
            className={cn("relative h-full rounded-[9px] px-2.5 transition-colors sm:px-3", active ? "text-ink" : "text-faint hover:text-mute")}
          >
            {active && (
              <motion.span
                layoutId="mode-pill"
                className={cn("absolute inset-0 rounded-[9px] border", m === "live" ? "border-ok/30 bg-ok/10" : "border-violet/30 bg-violet/10")}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative">{m}</span>
          </button>
        );
      })}
    </div>
  );
}

function Notifications() {
  const notifications = useClon((s) => s.notifications);
  const markRead = useClon((s) => s.markNotificationsRead);
  const pending = usePendingApprovals().length;
  const hydrated = useClon((s) => s.hydrated);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const badge = hydrated ? unread + pending : 0;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!open) markRead();
        }}
        className="relative grid h-9 w-9 place-items-center rounded-xl border border-line bg-white/[0.02] text-mute transition-colors hover:border-line-strong hover:text-ink"
        aria-label={`Notifications${badge ? ` (${badge})` : ""}`}
        aria-expanded={open}
      >
        <Bell className="h-4 w-4" strokeWidth={1.6} />
        {badge > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-cyan px-1 font-mono text-[9px] font-semibold text-void shadow-[0_0_12px_#5be7f5]">
            {badge}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="glass absolute right-0 top-11 z-50 w-[min(340px,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-panel/90"
          >
            {pending > 0 && (
              <Link
                href="/approvals"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 border-b border-line bg-cyan/[0.06] px-4 py-3 text-sm text-ink hover:bg-cyan/[0.1]"
              >
                <ShieldCheck className="h-4 w-4 text-cyan" />
                {pending} to approve
              </Link>
            )}
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-faint">All quiet</div>
              ) : (
                notifications.slice(0, 12).map((n) => (
                  <Link
                    key={n.id}
                    href={n.href ?? "/activity"}
                    onClick={() => setOpen(false)}
                    title={n.body}
                    className="flex items-center gap-2 border-b border-line/60 px-4 py-3 last:border-0 hover:bg-white/[0.03]"
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        n.kind === "error" ? "bg-danger" : n.kind === "approval" ? "bg-cyan" : n.kind === "conflict" ? "bg-warn" : "bg-ok",
                      )}
                    />
                    <span className="truncate text-sm text-ink">{n.title}</span>
                    <span className="ml-auto shrink-0 font-mono text-[10px] text-faint">{timeAgo(n.at)}</span>
                  </Link>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
