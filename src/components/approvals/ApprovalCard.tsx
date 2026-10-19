"use client";

import { CalendarPlus, Check, ExternalLink, LoaderCircle, Mail, TriangleAlert, X } from "lucide-react";
import { useMemo, useState, type CSSProperties } from "react";
import { decideApproval } from "@/lib/agent-client";
import { conflictsWith } from "@/lib/availability";
import { useClon } from "@/lib/store";
import { CLONES } from "@/lib/clones";
import { LOCALE, timeAgo } from "@/lib/time";
import type { ApprovalRequest, ProposedEvent } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge, ModeBadge, RiskBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CloneSigil } from "@/components/ui/CloneSigil";

const when = (e: ProposedEvent) => {
  const s = new Date(e.start);
  return `${s.toLocaleDateString(LOCALE, { weekday: "short" })} · ${s.toLocaleTimeString(LOCALE, {
    hour: "numeric",
    minute: "2-digit",
  })}–${new Date(e.end).toLocaleTimeString(LOCALE, { hour: "numeric", minute: "2-digit" })}`;
};

/** A human-in-the-loop checkpoint: nothing below runs until the user approves it. */
export function ApprovalCard({ approval, compact = false }: { approval: ApprovalRequest; compact?: boolean }) {
  const def = CLONES[approval.clone];
  const p = approval.payload;
  const options = p.kind === "calendar.createEvents" ? p.options : undefined;
  const [choice, setChoice] = useState(approval.selectedOption ?? 0);
  const pending = approval.status === "pending";
  const calendar = useClon((s) => s.calendar);

  // Re-check the shared (demo) calendar right before you decide — things may have changed since the proposal.
  const conflicts = useMemo(() => {
    if (!pending || approval.mode !== "demo" || p.kind !== "calendar.createEvents") return [];
    const chosen = options && options.length > 1 ? [options[choice]] : p.events;
    return chosen.flatMap((e) => conflictsWith(calendar, Date.parse(e.start), Date.parse(e.end)));
  }, [pending, approval.mode, p, options, choice, calendar]);

  return (
    <div
      className={cn("glass glass-rim relative overflow-hidden rounded-card", compact ? "p-4" : "p-5")}
      style={{ "--accent": def.accent } as CSSProperties}
    >
      {pending && <div className="absolute inset-y-0 left-0 w-[2px] bg-[linear-gradient(180deg,transparent,var(--accent),transparent)]" />}
      <div className="flex items-center gap-3">
        <CloneSigil clone={approval.clone} size={compact ? 30 : 36} />
        <h4 className="min-w-0 flex-1 truncate text-sm font-medium text-ink" title={approval.summary}>
          {approval.title}
        </h4>
        <span className="shrink-0 font-mono text-[10px] text-faint">{timeAgo(approval.createdAt)}</span>
      </div>

      <div className="mt-3 rounded-xl border border-line bg-void/40 p-3">
        {p.kind === "calendar.createEvents" ? (
          options && options.length > 1 ? (
            <fieldset disabled={!pending}>
              <legend className="sr-only">Choose a time</legend>
              <div className="space-y-1.5">
                {options.map((o, i) => (
                  <label
                    key={i}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-lg border px-2.5 py-2 text-xs transition-colors",
                      choice === i ? "border-accent-soft bg-accent-soft text-ink" : "border-line text-mute hover:text-ink",
                    )}
                  >
                    <input type="radio" className="accent-[var(--accent)]" checked={choice === i} onChange={() => setChoice(i)} />
                    <span className="truncate">{o.title}</span>
                    <span className="ml-auto shrink-0 font-mono text-[10px]">{when(o)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : (
            <ul className="space-y-1.5">
              {p.events.map((e, i) => (
                <li key={i} className="flex items-center gap-2.5 text-xs">
                  <CalendarPlus className="h-3.5 w-3.5 shrink-0 text-accent" />
                  <span className="truncate text-ink">{e.title}</span>
                  <span className="ml-auto shrink-0 font-mono text-[10px] text-mute">{when(e)}</span>
                </li>
              ))}
            </ul>
          )
        ) : (
          <div className="text-xs" title={p.body}>
            <div className="flex items-center gap-2 text-mute">
              <Mail className="h-3.5 w-3.5 shrink-0 text-accent" />
              <span className="truncate text-ink">{p.to}</span>
            </div>
            <div className="mt-1.5 truncate font-medium text-ink">{p.subject}</div>
            <p className="mt-1 line-clamp-2 whitespace-pre-line text-mute">{p.body}</p>
          </div>
        )}
      </div>

      {conflicts.length > 0 && (
        <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-warn">
          <TriangleAlert className="h-3 w-3 shrink-0" />
          <span className="truncate">
            Overlaps “{conflicts[0].title}”{conflicts.length > 1 ? ` +${conflicts.length - 1}` : ""}
          </span>
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!compact && <RiskBadge risk={approval.risk} />}
        <ModeBadge mode={approval.mode} />
        <div className="ml-auto flex items-center gap-2">
          {pending ? (
            <>
              <Button size="sm" variant="ghost" onClick={() => decideApproval(approval.id, false)}>
                <X className="h-3.5 w-3.5" /> Decline
              </Button>
              <Button
                size="sm"
                variant="accent"
                onClick={() => decideApproval(approval.id, true, options ? choice : undefined)}
                title={approval.mode === "demo" ? "Simulated — nothing real changes" : undefined}
              >
                <Check className="h-3.5 w-3.5" /> Approve
              </Button>
            </>
          ) : approval.status === "executing" ? (
            <Badge tone="cyan">
              <LoaderCircle className="h-3 w-3 animate-spin" /> Executing
            </Badge>
          ) : approval.status === "executed" ? (
            <Badge tone={approval.mode === "live" ? "ok" : "violet"}>
              <Check className="h-3 w-3" /> {approval.mode === "live" ? "Executed" : "Simulated"}
            </Badge>
          ) : approval.status === "failed" ? (
            <Badge tone="danger">Failed</Badge>
          ) : (
            <Badge>Declined</Badge>
          )}
        </div>
      </div>
      {approval.result && !pending && (
        <p className={cn("mt-2 line-clamp-2 text-xs", approval.status === "failed" ? "text-danger" : "text-mute")} title={approval.result}>
          {approval.result}
          {approval.link && (
            <a href={approval.link} target="_blank" rel="noreferrer" className="ml-1.5 inline-flex items-center gap-1 text-accent hover:underline">
              Open <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </p>
      )}
    </div>
  );
}
