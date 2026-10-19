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
import { CLONE_ICONS } from "@/components/ui/CloneSigil";
import { LogoMark } from "./Logo";

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Dashboard", icon: LayoutGrid },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/approvals", label: "Approvals", icon: ShieldCheck },
  { href: "/integrations", label: "Apps", icon: Plug },
  { href: "/settings", label: "Settings", icon: Settings },
];

const CLONE_ORDER: CloneId[] = ["master", "communication", "work", "life", "fitness"];

/** Icon rail: every label is a hover tooltip, never a column of text. */
export function Sidebar() {
  const pathname = usePathname();
  const pending = usePendingApprovals().length;
  const running = useClon((s) => s.running);
  const permissions = useClon((s) => s.permissions);
  const profile = useClon((s) => s.profile);
  const hydrated = useClon((s) => s.hydrated);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <aside className="sticky top-0 z-30 hidden h-dvh w-[76px] shrink-0 flex-col items-center border-r border-line/70 bg-abyss/30 py-4 backdrop-blur-xl lg:flex">
      <Link href="/" className="mb-6 grid h-11 w-11 place-items-center" aria-label="CLON home">
        <LogoMark />
      </Link>

      <nav className="flex flex-1 flex-col items-center gap-6" aria-label="Primary">
        <ul className="space-y-1.5">
          <NavItem {...NAV[0]} active={isActive(NAV[0].href)} />
        </ul>

        <ul className="space-y-1.5" aria-label="Clones">
          {CLONE_ORDER.map((id) => {
            const def = CLONES[id];
            const Icon = CLONE_ICONS[id];
            const href = `/clones/${id}`;
            const working = hydrated && running?.activeClones.includes(id);
            const disabled = id !== "master" && hydrated && !permissions[id].enabled;
            return (
              <li key={id}>
                <RailLink href={href} label={def.short} active={isActive(href)} accent={def.accent}>
                  <Icon
                    className={cn("h-[18px] w-[18px] transition-opacity", disabled ? "opacity-30" : "opacity-90", working && "animate-pulse-soft")}
                    style={{ color: def.accent, filter: working ? `drop-shadow(0 0 6px ${def.accent})` : undefined }}
                    strokeWidth={1.6}
                  />
                </RailLink>
              </li>
            );
          })}
        </ul>

        <ul className="space-y-1.5">
          {NAV.slice(1).map((item) => (
            <NavItem key={item.href} {...item} active={isActive(item.href)} count={item.href === "/approvals" && hydrated ? pending : undefined} />
          ))}
        </ul>
      </nav>

      <Link
        href="/settings"
        className="grid h-10 w-10 place-items-center rounded-xl bg-[linear-gradient(135deg,#5be7f533,#9879ff33)] font-display text-xs font-semibold text-ink ring-1 ring-white/10 transition-shadow hover:ring-cyan/40"
        aria-label={profile.name}
        title={profile.name}
      >
        {initials(profile.name)}
      </Link>
    </aside>
  );
}

function RailLink({
  href,
  label,
  active,
  accent = "#5be7f5",
  children,
}: {
  href: string;
  label: string;
  active: boolean;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative grid h-11 w-11 place-items-center rounded-xl transition-colors",
        active ? "bg-white/[0.06] text-ink" : "text-mute hover:bg-white/[0.03] hover:text-ink",
      )}
      style={{ "--accent": accent } as CSSProperties}
    >
      {children}
      {active && (
        <motion.span
          layoutId="nav-active"
          className="absolute -left-[15px] top-2.5 bottom-2.5 w-[2px] rounded-full"
          style={{ background: "var(--accent)", boxShadow: "0 0 10px var(--accent)" }}
          transition={{ type: "spring", stiffness: 400, damping: 34 }}
        />
      )}
      <span
        className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-x-1 -translate-y-1/2 whitespace-nowrap rounded-lg border border-line bg-panel/95 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-soft opacity-0 shadow-[0_12px_30px_-12px_rgb(0_0_0/0.8)] backdrop-blur transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
        aria-hidden
      >
        {label}
      </span>
    </Link>
  );
}

function NavItem({ href, label, icon: Icon, active, count }: { href: string; label: string; icon: LucideIcon; active: boolean; count?: number }) {
  return (
    <li>
      <RailLink href={href} label={label} active={active}>
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.6} />
        {!!count && (
          <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-cyan px-1 font-mono text-[9px] font-semibold text-void shadow-[0_0_10px_#5be7f5]">
            {count}
          </span>
        )}
      </RailLink>
    </li>
  );
}
