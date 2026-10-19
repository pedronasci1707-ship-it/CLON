"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { Activity, LayoutGrid, Plug, Settings, ShieldCheck, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useClon } from "@/lib/store";
import type { AppNotification, SystemStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function AppShell({ children }: { children: React.ReactNode }) {
  useBootstrap();
  return (
    <MotionConfig reducedMotion="user">
      <div className="atmosphere" aria-hidden />
      <a
        href="#main"
        className="fixed left-4 top-3 z-[60] -translate-y-20 rounded-lg bg-panel px-3 py-2 text-sm text-ink focus:translate-y-0"
      >
        Skip to content
      </a>
      <div className="relative z-10 flex min-h-dvh">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main id="main" className="flex-1 px-4 pb-28 pt-8 sm:px-6 lg:pb-14 xl:px-10">
            {children}
          </main>
        </div>
      </div>
      <MobileNav />
      <Toaster />
    </MotionConfig>
  );
}

/** Rehydrate persisted state after mount, seed the demo world and read server capabilities. */
function useBootstrap() {
  useEffect(() => {
    const unsub = useClon.persist.onFinishHydration(() => {
      useClon.setState({ hydrated: true });
      useClon.getState().seed();
    });
    void useClon.persist.rehydrate();

    const ctrl = new AbortController();
    fetch("/api/system/status", { signal: ctrl.signal })
      .then((r) => r.json() as Promise<SystemStatus>)
      .then((status) => {
        const s = useClon.getState();
        s.setSystem(status);
        if (s.mode === "live" && !status.liveAvailable) {
          s.setMode("demo");
          s.notify({
            kind: "error",
            title: "Switched to Demo mode",
            body: "No live apps are configured.",
            href: "/integrations",
          });
        }
      })
      .catch(() => undefined);
    return () => {
      unsub();
      ctrl.abort();
    };
  }, []);
}

const MOBILE_NAV = [
  { href: "/", icon: LayoutGrid, label: "Home" },
  { href: "/clones/master", icon: Sparkles, label: "Master" },
  { href: "/approvals", icon: ShieldCheck, label: "Approvals" },
  { href: "/activity", icon: Activity, label: "Activity" },
  { href: "/integrations", icon: Plug, label: "Apps" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      className="glass fixed inset-x-3 bottom-3 z-40 flex items-center justify-between rounded-2xl bg-panel/80 px-2 py-1.5 lg:hidden"
      aria-label="Mobile"
    >
      {MOBILE_NAV.map(({ href, icon: Icon, label }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative grid h-11 flex-1 place-items-center rounded-xl transition-colors",
              active ? "bg-white/[0.06] text-cyan" : "text-mute",
            )}
          >
            <Icon className="h-5 w-5" strokeWidth={1.6} />
            {active && <span className="absolute bottom-1 h-[3px] w-[3px] rounded-full bg-cyan shadow-[0_0_6px_#5be7f5]" aria-hidden />}
          </Link>
        );
      })}
    </nav>
  );
}

/** Surfaces new notifications briefly in the corner. */
function Toaster() {
  const notifications = useClon((s) => s.notifications);
  const hydrated = useClon((s) => s.hydrated);
  const [toasts, setToasts] = useState<AppNotification[]>([]);
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (seen.current === null) {
      seen.current = new Set(notifications.map((n) => n.id));
      return;
    }
    const fresh = notifications.filter((n) => !seen.current!.has(n.id));
    if (!fresh.length) return;
    fresh.forEach((n) => seen.current!.add(n.id));
    setToasts((t) => [...fresh.slice(0, 2), ...t].slice(0, 3));
  }, [notifications, hydrated]);

  const dismiss = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));

  return (
    <div className="pointer-events-none fixed bottom-20 right-4 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2 lg:bottom-6" aria-live="polite">
      <AnimatePresence>
        {toasts.map((n) => (
          <Toast key={n.id} n={n} onDone={() => dismiss(n.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function Toast({ n, onDone }: { n: AppNotification; onDone: () => void }) {
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const t = setTimeout(() => done.current(), 5200);
    return () => clearTimeout(t);
  }, []);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 24, filter: "blur(4px)" }}
      animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="glass pointer-events-auto flex items-start gap-3 rounded-2xl bg-panel/85 p-3.5"
    >
      <span
        className={cn(
          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
          n.kind === "error" ? "bg-danger" : n.kind === "approval" ? "bg-cyan" : n.kind === "conflict" ? "bg-warn" : "bg-ok",
        )}
      />
      <Link href={n.href ?? "/activity"} className="min-w-0 flex-1" title={n.body}>
        <div className="text-sm text-ink">{n.title}</div>
        {n.body && <div className="mt-0.5 truncate text-xs text-mute">{n.body}</div>}
      </Link>
      <button onClick={onDone} className="text-faint hover:text-ink" aria-label="Dismiss">
        <X className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  );
}
