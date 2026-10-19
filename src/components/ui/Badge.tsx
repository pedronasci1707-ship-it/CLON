import { Ban, Check, Clock, Minus, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Mode, Outcome, Risk } from "@/lib/types";

type Tone = "neutral" | "cyan" | "violet" | "ok" | "warn" | "danger" | "accent";

const tones: Record<Tone, string> = {
  neutral: "text-mute border-line bg-white/[0.03]",
  cyan: "text-cyan border-cyan/25 bg-cyan/[0.07]",
  violet: "text-violet border-violet/25 bg-violet/[0.08]",
  ok: "text-ok border-ok/25 bg-ok/[0.07]",
  warn: "text-warn border-warn/25 bg-warn/[0.07]",
  danger: "text-danger border-danger/30 bg-danger/[0.08]",
  accent: "text-accent border-accent-soft bg-accent-soft",
};

export function Badge({
  tone = "neutral",
  className,
  children,
  title,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-[22px] shrink-0 items-center gap-1 rounded-full border px-2 font-mono text-[10px] uppercase tracking-[0.12em]",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Makes it unambiguous whether something is sample data or real. */
export function ModeBadge({ mode, className }: { mode: Mode | "sample" | "manual"; className?: string }) {
  if (mode === "live")
    return (
      <Badge tone="ok" className={className} title="Real data from a connected account">
        <span className="h-1.5 w-1.5 rounded-full bg-ok" /> Live
      </Badge>
    );
  if (mode === "manual")
    return (
      <Badge tone="cyan" className={className} title="Logged by you on this device">
        Yours
      </Badge>
    );
  if (mode === "sample")
    return (
      <Badge tone="warn" className={className} title="Illustrative sample — not a live listing">
        Sample
      </Badge>
    );
  return (
    <Badge tone="violet" className={className} title="Seeded demo data — nothing real is read or changed">
      Demo
    </Badge>
  );
}

const OUTCOME: Record<Outcome, { icon: LucideIcon; className: string; label: string }> = {
  success: { icon: Check, className: "text-ok", label: "Done · real" },
  simulated: { icon: Check, className: "text-violet", label: "Simulated" },
  error: { icon: X, className: "text-danger", label: "Error" },
  blocked: { icon: Ban, className: "text-warn", label: "Blocked" },
  pending: { icon: Clock, className: "text-cyan", label: "Awaiting you" },
  approved: { icon: Check, className: "text-ok", label: "Approved" },
  rejected: { icon: Minus, className: "text-faint", label: "Declined" },
};

/** Outcome as a single glyph; the wording lives in the tooltip and for screen readers. */
export function OutcomeIcon({ outcome }: { outcome: Outcome }) {
  const { icon: Icon, className, label } = OUTCOME[outcome];
  return (
    <span title={label} className={cn("grid h-5 w-5 shrink-0 place-items-center", className)}>
      <Icon className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function RiskBadge({ risk }: { risk: Risk }) {
  const map: Record<Risk, { tone: Tone; label: string }> = {
    read: { tone: "neutral", label: "Read only" },
    draft: { tone: "cyan", label: "Draft" },
    write: { tone: "warn", label: "Changes data" },
    external: { tone: "danger", label: "Reaches others" },
  };
  return <Badge tone={map[risk].tone}>{map[risk].label}</Badge>;
}
