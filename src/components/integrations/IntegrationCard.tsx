"use client";

import type { LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Switch } from "@/components/ui/Controls";

export type ConnectionState = "connected" | "not_connected" | "configured" | "not_configured" | "error" | "planned" | "checking";

const STATE: Record<ConnectionState, { label: string; tone: "ok" | "neutral" | "danger" | "warn" | "cyan" }> = {
  connected: { label: "Connected", tone: "ok" },
  configured: { label: "Ready", tone: "ok" },
  not_connected: { label: "Off", tone: "neutral" },
  not_configured: { label: "Not set", tone: "neutral" },
  error: { label: "Error", tone: "danger" },
  planned: { label: "Planned", tone: "neutral" },
  checking: { label: "Checking", tone: "cyan" },
};

/** One connected app: icon, name, state and a switch. What it does is the tooltip. */
export function IntegrationCard({
  icon: Icon,
  name,
  provider,
  state,
  accent = "#5be7f5",
  enabled,
  onToggle,
  action,
  footnote,
}: {
  icon: LucideIcon;
  name: string;
  provider: string;
  state: ConnectionState;
  accent?: string;
  enabled?: boolean;
  onToggle?: (v: boolean) => void;
  action?: React.ReactNode;
  footnote?: string;
}) {
  const s = STATE[state];
  const live = state === "connected" || state === "configured";
  return (
    <div
      className={cn("glass glass-rim flex flex-col rounded-panel p-5", state === "planned" && "opacity-70")}
      style={{ "--accent": accent } as CSSProperties}
      title={provider}
    >
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-accent-soft bg-accent-soft">
          <Icon className="h-5 w-5 text-accent" strokeWidth={1.6} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-medium text-ink">{name}</h3>
          <Badge tone={s.tone} className="mt-1">
            {live && <span className="h-1.5 w-1.5 rounded-full bg-ok" />}
            {s.label}
          </Badge>
        </div>
        {onToggle && enabled !== undefined && <Switch checked={enabled} onChange={onToggle} label={`Use ${name} in CLON`} accent={accent} />}
      </div>
      {(action || footnote) && (
        <div className="mt-auto pt-4">
          {action}
          {footnote && <p className="font-mono text-[10px] text-faint">{footnote}</p>}
        </div>
      )}
    </div>
  );
}
