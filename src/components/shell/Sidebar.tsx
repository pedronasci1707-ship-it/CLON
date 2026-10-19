"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, LayoutGrid, Plug, Settings, ShieldCheck, type LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import type { CSSProperties } from "react";
import { CLONES } from "@/lib/clones";
import { usePendingApprovals } from "@/lib/hooks";
import { useClon } from "@/lib/store";
import type { CloneId } from "@/lib/types";
import { cn, initials } from "@/lib/utils";
import { LogoMark, Wordmark } from "./Logo";

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Dashboard", icon: LayoutGrid },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/approvals", label: "Approvals", icon: ShieldCheck },
  { href: "/integrations", label: "Connected Apps", icon: Plug },
  { href: "/settings", label: "Settings", icon: Settings },
];

const CLONE_ORDER: CloneId[] = ["master", "communication", "work", "life", "fitness"];

export function Sidebar() {
  const pathname = usePathname();
  const pending = usePendingApprovals().length;
  const running = useClon((s) => s.running);
  const permissions = useClon((s) => s.permissions);
  const profile = useClon((s) => s.profile);
  const mode = useClon((s) => s.mode);
  const hydrated = useClon((s) => s.hydrated);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <aside className="sticky top-0 z-30 hidden h-dvh shrink-0 flex-col border-r border-line bg-abyss/40 backdrop-blur-xl lg:flex lg:w-[84px] xl:w-[244px]">
      <Link href="/" className="flex h-16 items-center gap-3 px-6 lg:justify-center xl:justify-start" aria-label="CLON home">
        <LogoMark />
        <Wordmark className="hidden xl:inline" />
      </Link>

      <nav className="flex-1 space-y-7 overflow-y-auto px-3 pt-4 no-scrollbar" aria-label="Primary">
        <ul className="space-y-1">
          {NAV.slice(0, 1).map((item) => (
            <NavItem key={item.href} {...item} active={isActive(item.href)} />
          ))}
        </ul>

        <div>
          <div className="mb-2 hidden px-3 font-mono text-[10px] uppercase tracking-[0.22em] text-faint xl:block">My clones</div>
          <ul className="space-y-0.5">
            {CLONE_ORDER.map((id) => {
              const def = CLONES[id];
              const href = `/clones/${id}`;
              const working = hydrated && running?.activeClones.includes(id);
              const disabled = id !== "master" && hydrated && !permissions[id].enabled;
              return (
                <li key={id}>
                  <Link
                    href={href}
                    title={def.name}
                    className={cn(
                      "group relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm transition-colors lg:justify-center xl:justify-start",
                      isActive(href) ? "bg-white/[0.06] text-ink" : "text-mute hover:bg-white/[0.03] hover:text-ink",
                    )}
                    style={{ "--accent": def.accent } as CSSProperties}
                  >
                    <span className="relative grid h-5 w-5 place-items-center">
                      <span
                        className={cn("h-2 w-2 rounded-full transition-all", working && "animate-pulse-soft", disabled && "opacity-30")}
                        style={{ background: def.accent, boxShadow: `0 0 12px ${def.accent}` }}
                      />
                    </span>
                    <span className={cn("hidden truncate xl:inline", disabled && "line-through opacity-60")}>{def.short}</span>
                    {working && <span className="ml-auto hidden font-mono text-[9px] uppercase tracking-widest text-accent xl:inline">live</span>}
                    {isActive(href) && <ActiveBar />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <ul className="space-y-1">
          {NAV.slice(1).map((item) => (
            <NavItem
              key={item.href}
              {...item}
              active={isActive(item.href)}
              count={item.href === "/approvals" && hydrated ? pending : undefined}
            />
          ))}
        </ul>
      </nav>

      <Link
        href="/settings"
        className="m-3 flex items-center gap-3 rounded-2xl border border-line bg-white/[0.02] p-2.5 transition-colors hover:border-line-strong lg:justify-center xl:justify-start"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[linear-gradient(135deg,#5be7f533,#9879ff33)] font-display text-xs font-semibold text-ink ring-1 ring-white/10">
          {initials(profile.name)}
        </span>
        <span className="hidden min-w-0 xl:block">
          <span className="block truncate text-sm text-ink">{profile.name}</span>
          <span className="block truncate font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
            {hydrated ? (mode === "live" ? "Live mode" : "Demo mode") : "—"} · {profile.city}
          </span>
        </span>
      </Link>
    </aside>
  );
}

function ActiveBar() {
  return (
    <motion.span
      layoutId="nav-active"
      className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full"
      style={{ background: "var(--accent)", boxShadow: "0 0 10px var(--accent)" }}
      transition={{ type: "spring", stiffness: 400, damping: 34 }}
    />
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  count,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  count?: number;
}) {
  return (
    <li>
      <Link
        href={href}
        title={label}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm transition-colors lg:justify-center xl:justify-start",
          active ? "bg-white/[0.06] text-ink" : "text-mute hover:bg-white/[0.03] hover:text-ink",
        )}
      >
        <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.6} />
        <span className="hidden xl:inline">{label}</span>
        {!!count && (
          <span className="absolute right-2 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-cyan px-1 font-mono text-[9px] font-semibold text-void xl:static xl:ml-auto">
            {count}
          </span>
        )}
        {active && <ActiveBar />}
      </Link>
    </li>
  );
}
