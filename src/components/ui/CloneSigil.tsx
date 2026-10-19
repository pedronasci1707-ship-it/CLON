import { Briefcase, Compass, Dumbbell, MessageSquareText, Sparkles, type LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";
import { CLONES } from "@/lib/clones";
import type { CloneId } from "@/lib/types";
import { cn } from "@/lib/utils";

export const CLONE_ICONS: Record<CloneId, LucideIcon> = {
  master: Sparkles,
  communication: MessageSquareText,
  work: Briefcase,
  life: Compass,
  fitness: Dumbbell,
};

/** The holographic emblem that identifies each clone. */
export function CloneSigil({
  clone,
  size = 44,
  active = false,
  className,
}: {
  clone: CloneId;
  size?: number;
  active?: boolean;
  className?: string;
}) {
  const def = CLONES[clone];
  const Icon = CLONE_ICONS[clone];
  return (
    <span
      className={cn("relative inline-grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size, "--accent": def.accent } as CSSProperties}
      aria-hidden
    >
      <span
        className={cn("absolute inset-0 rounded-[30%] border border-accent-soft", active && "animate-pulse-soft")}
        style={{
          background: `radial-gradient(circle at 30% 20%, ${def.accent}33, transparent 65%), linear-gradient(160deg, ${def.accent}1f, ${def.accentAlt}10)`,
          boxShadow: `inset 0 1px 0 rgb(255 255 255 / 0.08), 0 0 ${active ? 28 : 18}px -6px ${def.accent}${active ? "cc" : "80"}`,
        }}
      />
      <svg className="absolute inset-0 animate-spin-slower opacity-60" viewBox="0 0 44 44" fill="none">
        <circle cx="22" cy="22" r="19.5" stroke={def.accent} strokeOpacity="0.35" strokeWidth="0.75" strokeDasharray="1.5 4.5" />
      </svg>
      <Icon className="relative" style={{ color: def.accent, width: size * 0.42, height: size * 0.42 }} strokeWidth={1.6} />
    </span>
  );
}
