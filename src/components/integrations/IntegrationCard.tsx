"use client";

import type { LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Switch } from "@/components/ui/Controls";

export type ConnectionState = "connected" | "not_connected" | "configured" | "not_configured" | "error" | "planned" | "checking";

const STATE: Record<ConnectionState, { label: string; tone: "ok" | "neutral" | "danger" | "warn" | "cyan" }> = {
  connected: { label: "Connected", tone: "ok" },
  configured: { label: "Configured", tone: "ok" },
  not_connected: { label: "Not connected", tone: "neutral" },
  not_configured: { label: "Not configured", tone: "neutral" },
  error: { label: "Error", tone: "danger" },
  planned: { label: "Planned", tone: "neutral" },
  checking: { label: "Checking…", tone: "cyan" },
};

export function IntegrationCard({
  icon: Icon,
  name,
  provider,
  description,
  scopes,
  usedBy,
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
  description: string;
  scopes?: string[];
  usedBy?: string[];
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
    >
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-accent-soft bg-accent-soft">
          <Icon className="h-5 w-5 text-accent" strokeWidth={1.6} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-medium text-ink">{name}</h3>
            <Badge tone={s.tone}>
              {live && <span className="h-1.5 w-1.5 rounded-full bg-ok" />}
              {s.label}
            </Badge>
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">via {provider}</div>
        </div>
        {onToggle && enabled !== undefined && <Switch checked={enabled} onChange={onToggle} label={`Use ${name} in CLON`} accent={accent} />}
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-mute">{description}</p>
      {scopes && scopes.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">What CLON uses</div>
          <ul className="flex flex-wrap gap-1.5">
            {scopes.map((sc) => (
              <li key={sc} className="rounded-md border border-line bg-white/[0.02] px-1.5 py-0.5 font-mono text-[10px] text-soft">
                {sc}
              </li>
            ))}
          </ul>
        </div>
      )}
      {usedBy && usedBy.length > 0 && <p className="mt-2 text-[11px] text-faint">Used by: {usedBy.join(" · ")}</p>}
      {(action || footnote) && (
        <div className="mt-auto pt-4">
          {action}
          {footnote && <p className="mt-2 text-[11px] text-faint">{footnote}</p>}
        </div>
      )}
    </div>
  );
}
