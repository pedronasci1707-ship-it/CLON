"use client";

import {
  CalendarClock,
  CalendarDays,
  Check,
  Clock,
  ExternalLink,
  EyeOff,
  Flame,
  Inbox,
  Mail,
  MapPin,
  Reply,
  ShieldAlert,
  Sparkles,
  Target,
  TriangleAlert,
} from "lucide-react";
import { useState, type CSSProperties } from "react";
import { runCommand } from "@/lib/agent-client";
import { CLONES } from "@/lib/clones";
import { useClon } from "@/lib/store";
import type { Artifact, CloneId } from "@/lib/types";
import { LOCALE } from "@/lib/time";
import { cn, EMAIL_RE } from "@/lib/utils";
import { ApprovalCard } from "@/components/approvals/ApprovalCard";
import { Badge, ModeBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

const tf = (iso: string) => new Date(iso).toLocaleTimeString(LOCALE, { hour: "numeric", minute: "2-digit" });
const host = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};
const df = (iso: string) => new Date(iso).toLocaleDateString(LOCALE, { weekday: "short", month: "short", day: "numeric" });

function Frame({
  icon: Icon,
  title,
  right,
  children,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-void/35 p-3.5" style={accent ? ({ "--accent": accent } as CSSProperties) : undefined}>
      <div className="mb-2.5 flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-accent" />
        <span className="text-[12px] font-medium text-soft">{title}</span>
        <span className="ml-auto flex items-center gap-1.5">{right}</span>
      </div>
      {children}
    </div>
  );
}

export function ArtifactView({ artifact, clone }: { artifact: Artifact; clone: CloneId }) {
  const approvals = useClon((s) => s.approvals);
  const running = useClon((s) => s.running);

  switch (artifact.kind) {
    case "calendar":
      return (
        <Frame
          icon={CalendarDays}
          title={artifact.title}
          right={<ModeBadge mode={artifact.source === "google" ? "live" : "demo"} />}
        >
          {artifact.redactedCount ? (
            <p className="mb-2 flex items-center gap-1.5 text-[11px] text-faint">
              <EyeOff className="h-3 w-3" /> {artifact.redactedCount} work event(s) visible only as “Busy”
            </p>
          ) : null}
          <ul className="space-y-1">
            {artifact.events.length === 0 && <li className="text-xs text-mute">No events in this window.</li>}
            {artifact.events.map((e) => (
              <li key={e.id} className="flex items-center gap-2 text-xs">
                <span className="w-[120px] shrink-0 font-mono text-[10.5px] text-faint">
                  {tf(e.start)} – {tf(e.end)}
                </span>
                <span className={cn("truncate", e.redacted ? "italic text-mute" : "text-ink")}>{e.title}</span>
              </li>
            ))}
          </ul>
          {artifact.free.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {artifact.free.map((f) => (
                <span key={f.start} className="rounded-full border border-ok/25 bg-ok/[0.06] px-2 py-0.5 font-mono text-[10px] text-ok">
                  free {tf(f.start)}–{tf(f.end)}
                </span>
              ))}
            </div>
          )}
        </Frame>
      );

    case "events":
      return (
        <Frame
          icon={Sparkles}
          title={artifact.title}
          accent={CLONES.life.accent}
          right={artifact.source === "parallel" ? <Badge tone="ok">Parallel · live web</Badge> : <ModeBadge mode="sample" />}
        >
          {artifact.source === "sample" && (
            <p className="mb-2 text-[11px] text-warn/80">Illustrative samples — not live listings. Connect Parallel for real, sourced results.</p>
          )}
          <div className="space-y-2">
            {artifact.items.length === 0 && <p className="text-xs text-mute">No results matched with enough evidence.</p>}
            {artifact.items.map((it, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-xl border p-3 transition-colors",
                  artifact.selectedIndex === i ? "border-accent-soft bg-accent-soft" : "border-line bg-white/[0.015]",
                )}
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    {it.url ? (
                      <a href={it.url} target="_blank" rel="noreferrer" className="group inline-flex items-start gap-1 text-[13px] font-medium text-ink hover:text-accent">
                        {it.title}
                        <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 opacity-60 group-hover:opacity-100" />
                      </a>
                    ) : (
                      <div className="text-[13px] font-medium text-ink">{it.title}</div>
                    )}
                    <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[10px] text-faint">
                      {it.when && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {it.when}
                        </span>
                      )}
                      {it.venue && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {it.venue}
                        </span>
                      )}
                      {it.url && <span className="truncate">{host(it.url)}</span>}
                    </div>
                  </div>
                  {artifact.selectedIndex === i && <Badge tone="accent">Selected</Badge>}
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-mute">{it.summary}</p>
                {it.evidence && (
                  <blockquote className="mt-1.5 border-l border-line-strong pl-2 text-[11px] italic text-faint">“{it.evidence}”</blockquote>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {artifact.source === "parallel" &&
                    (it.dateVerified ? <Badge tone="ok">Date matched in source</Badge> : <Badge tone="warn">Date not confirmed</Badge>)}
                  {it.fitsSchedule === true && <Badge tone="cyan">Fits your free time</Badge>}
                  {it.fitsSchedule === false && <Badge tone="warn">Conflicts with calendar</Badge>}
                  {artifact.resumeToken && artifact.selectedIndex !== i && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto h-7"
                      disabled={!!running}
                      onClick={() =>
                        runCommand(clone, "", {
                          resume: { token: artifact.resumeToken!, input: { eventIndex: String(i) } },
                          displayText: `Use “${it.title}” instead`,
                        })
                      }
                    >
                      Use this one
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Frame>
      );

    case "input":
      return <InputRequest artifact={artifact} clone={clone} />;

    case "email_draft": {
      const approval = artifact.approvalId ? approvals.find((a) => a.id === artifact.approvalId) : undefined;
      const status =
        approval?.status === "executed"
          ? approval.mode === "live"
            ? "created"
            : "simulated"
          : approval?.status === "failed"
            ? "failed"
            : approval?.status === "rejected"
              ? "blocked"
              : artifact.status;
      const draft = (
        <div className="min-w-0 rounded-xl border border-accent-soft bg-accent-soft/40 p-3">
          <div className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-accent">
            <Sparkles className="h-3 w-3" /> Draft by CLON
          </div>
          <div className="text-[11px] text-mute">
            To <span className="text-ink">{artifact.to}</span>
          </div>
          <div className="mt-1 text-[13px] font-medium text-ink">{artifact.subject}</div>
          <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-soft">{artifact.body}</p>
        </div>
      );
      return (
        <Frame
          icon={Mail}
          title={artifact.inReplyTo ? "Reply drafted" : "Email draft"}
          accent={CLONES.communication.accent}
          right={
            status === "created" ? (
              <Badge tone="ok">
                <Check className="h-3 w-3" /> Saved to Gmail drafts
              </Badge>
            ) : status === "simulated" ? (
              <Badge tone="violet">Simulated · not sent</Badge>
            ) : status === "pending_approval" ? (
              <Badge tone="cyan">Awaiting approval</Badge>
            ) : status === "blocked" ? (
              <Badge tone="warn">Not created</Badge>
            ) : (
              <Badge tone="danger">Failed</Badge>
            )
          }
        >
          {artifact.inReplyTo ? (
            <div className="grid gap-2.5 @xl:grid-cols-2">
              <div className="min-w-0 rounded-xl border border-line bg-white/[0.015] p-3">
                <div className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
                  <Reply className="h-3 w-3" /> Original
                </div>
                <div className="text-[11px] text-mute">
                  From <span className="text-ink">{artifact.inReplyTo.from}</span>
                </div>
                <div className="mt-1 text-[13px] font-medium text-ink">{artifact.inReplyTo.subject}</div>
                <p className="mt-2 line-clamp-[10] whitespace-pre-line text-xs leading-relaxed text-mute">{artifact.inReplyTo.body}</p>
              </div>
              {draft}
            </div>
          ) : (
            draft
          )}
          <p className="mt-2 text-[11px] text-faint">
            {status === "created" && (
              <>
                Created via Composio{artifact.draftId ? ` · draft id ${artifact.draftId}` : ""}. Nothing was sent — review it in Gmail.{" "}
                {artifact.link && (
                  <a href={artifact.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                    Open drafts <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </>
            )}
            {status === "simulated" && "Demo mode: no email was created or sent. Connect Gmail and switch to Live to save real drafts."}
            {status === "pending_approval" && "Your Communication clone is set to “approval required” — approve below to save this draft."}
            {status === "blocked" && (artifact.error ?? "The draft was not created.")}
            {status === "failed" && <span className="text-danger">{artifact.error ?? approval?.result ?? "The connected service returned an error."}</span>}
          </p>
        </Frame>
      );
    }

    case "slots":
      return (
        <Frame icon={CalendarClock} title={artifact.title}>
          <div className="flex flex-wrap gap-1.5">
            {artifact.slots.length === 0 && <span className="text-xs text-mute">No slot fits — your day is fully booked.</span>}
            {artifact.slots.map((s, i) => (
              <span
                key={s.start}
                className={cn(
                  "rounded-full border px-2.5 py-1 font-mono text-[11px]",
                  i === 0 ? "border-accent-soft bg-accent-soft text-ink" : "border-line text-mute",
                )}
              >
                {i === 0 && "★ "}
                {df(s.start)} · {tf(s.start)}–{tf(s.end)}
              </span>
            ))}
          </div>
        </Frame>
      );

    case "workout":
      return (
        <Frame icon={Flame} title={artifact.title} accent={CLONES.fitness.accent} right={<Badge tone="accent">{artifact.durationMin} min · {artifact.intensity}</Badge>}>
          <ol className="space-y-1.5">
            {artifact.blocks.map((b, i) => (
              <li key={i} className="flex gap-2.5 text-xs">
                <span className="w-4 shrink-0 font-mono text-[10px] text-faint">{i + 1}</span>
                <span className="text-ink">{b.name}</span>
                <span className="ml-auto text-right text-mute">{b.detail}</span>
              </li>
            ))}
          </ol>
          <p className="mt-2.5 text-[11.5px] text-soft">{artifact.rationale}</p>
          <p className="mt-1.5 text-[11px] text-faint">{artifact.safety}</p>
        </Frame>
      );

    case "day_plan":
      return (
        <Frame icon={CalendarDays} title={`Proposed plan · ${df(artifact.date)}`} right={<Badge tone="cyan">{artifact.blocks.filter((b) => b.kind === "proposed").length} new blocks</Badge>}>
          <ol className="relative space-y-1">
            {artifact.blocks.map((b, i) => {
              const accent = b.clone ? CLONES[b.clone].accent : "#8593b3";
              return (
                <li
                  key={i}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs",
                    b.kind === "proposed" ? "border border-dashed bg-white/[0.02]" : "border border-transparent",
                  )}
                  style={b.kind === "proposed" ? { borderColor: `${accent}55` } : undefined}
                >
                  <span className="w-[112px] shrink-0 font-mono text-[10.5px] text-faint">
                    {tf(b.start)} – {tf(b.end)}
                  </span>
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: accent, opacity: b.kind === "proposed" ? 1 : 0.45 }} />
                  <span className={cn("truncate", b.kind === "proposed" ? "text-ink" : b.redacted ? "italic text-mute" : "text-mute")}>{b.title}</span>
                  {b.kind === "proposed" && b.clone && (
                    <span className="ml-auto shrink-0 font-mono text-[9.5px] uppercase tracking-[0.12em]" style={{ color: accent }}>
                      {CLONES[b.clone].short}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
          {artifact.conflicts.length > 0 && (
            <div className="mt-2.5 space-y-1">
              {artifact.conflicts.map((c, i) => (
                <p key={i} className="flex items-start gap-1.5 text-[11.5px] text-warn/90">
                  <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" /> {c}
                </p>
              ))}
            </div>
          )}
        </Frame>
      );

    case "priorities":
      return (
        <Frame icon={Target} title="Priorities" accent={CLONES.work.accent}>
          <ol className="space-y-1.5">
            {artifact.items.map((p, i) => (
              <li key={i} className="flex gap-2.5 rounded-lg border border-line bg-white/[0.015] px-2.5 py-2 text-xs">
                <span className={cn("mt-0.5 shrink-0 font-mono text-[10px] uppercase", p.priority === "p0" ? "text-danger" : p.priority === "p1" ? "text-warn" : "text-mute")}>
                  {p.priority}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-ink">{p.title}</div>
                  <div className="mt-0.5 text-[11px] text-mute">
                    {p.project}
                    {p.due ? ` · due ${df(p.due)}` : ""} · {p.reason}
                  </div>
                </div>
                {p.slot && <span className="shrink-0 self-center font-mono text-[10px] text-accent">{p.slot}</span>}
              </li>
            ))}
          </ol>
        </Frame>
      );

    case "inbox":
      return (
        <Frame
          icon={Inbox}
          title="Inbox triage"
          accent={CLONES.communication.accent}
          right={<ModeBadge mode={artifact.source === "gmail" ? "live" : "demo"} />}
        >
          <div className="mb-2.5 flex gap-4 font-mono text-[11px] text-mute">
            <span>
              <span className="text-ink">{artifact.unread}</span> unread
            </span>
            <span>
              <span className="text-accent">{artifact.needsReply}</span> need a reply
            </span>
          </div>
          {artifact.summary && <p className="mb-2.5 text-xs leading-relaxed text-soft">{artifact.summary}</p>}
          <ul className="space-y-1.5">
            {artifact.items.map((m) => (
              <li key={m.id} className={cn("rounded-lg border px-2.5 py-2 text-xs", m.flagged ? "border-danger/30 bg-danger/[0.05]" : "border-line bg-white/[0.015]")}>
                <div className="flex items-center gap-2">
                  <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", m.priority === "high" ? "bg-danger" : m.priority === "normal" ? "bg-cyan" : "bg-faint")} />
                  <span className="shrink-0 text-ink">{m.from}</span>
                  <span className="truncate text-mute">— {m.subject}</span>
                  <span className="ml-auto flex shrink-0 gap-1">
                    {m.meetingRequest && <Badge tone="cyan">Meeting</Badge>}
                    {m.needsReply && <Badge tone="accent">Reply</Badge>}
                  </span>
                </div>
                {m.flagged && (
                  <p className="mt-1 flex items-start gap-1.5 pl-3.5 text-[11px] text-danger/90">
                    <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0" /> {m.flagged}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Frame>
      );

    case "fitness_stats": {
      const max = Math.max(30, ...artifact.days.map((d) => d.minutes));
      return (
        <Frame
          icon={Flame}
          title="Training consistency · last 7 days"
          accent={CLONES.fitness.accent}
          right={<ModeBadge mode={artifact.source === "manual" ? "manual" : "demo"} />}
        >
          <div className="flex h-24 items-end gap-1.5">
            {artifact.days.map((d) => (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-md bg-[linear-gradient(180deg,var(--accent),color-mix(in_oklab,var(--accent)_25%,transparent))]"
                  style={{ height: `${Math.max(3, (d.minutes / max) * 80)}px`, opacity: d.minutes ? 1 : 0.2 }}
                  title={`${d.minutes} min`}
                />
                <span className="font-mono text-[9px] text-faint">{new Date(d.date).toLocaleDateString(LOCALE, { weekday: "narrow" })}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            {[
              [artifact.sessions, `of ${artifact.goalSessions} sessions`],
              [artifact.minutes, "minutes"],
              [artifact.activeDays, "active days"],
              [artifact.streak, "day streak"],
            ].map(([v, l]) => (
              <div key={String(l)} className="rounded-lg border border-line py-1.5">
                <div className="font-display text-base text-ink">{v}</div>
                <div className="text-[10px] text-faint">{l}</div>
              </div>
            ))}
          </div>
        </Frame>
      );
    }

    case "training_plan":
      return (
        <Frame icon={CalendarDays} title={artifact.title} accent={CLONES.fitness.accent}>
          <ol className="space-y-1.5">
            {artifact.days.map((d, i) => (
              <li key={i} className="flex gap-3 rounded-lg border border-line bg-white/[0.015] px-2.5 py-2 text-xs">
                <span className="w-16 shrink-0 font-mono text-[10.5px] text-accent">{d.day}</span>
                <div className="min-w-0">
                  <div className="text-ink">{d.focus}</div>
                  <div className="mt-0.5 text-[11px] text-mute">{d.detail}</div>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-[11px] text-faint">{artifact.safety}</p>
        </Frame>
      );

    case "brief":
      return (
        <Frame icon={Target} title={`Brief · ${artifact.meeting}`} accent={CLONES.work.accent} right={<span className="font-mono text-[10px] text-faint">{artifact.when}</span>}>
          <ul className="space-y-1.5">
            {artifact.points.map((p, i) => (
              <li key={i} className="flex gap-2 text-xs text-soft">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" /> {p}
              </li>
            ))}
          </ul>
          {artifact.related.length > 0 && (
            <div className="mt-2.5 border-t border-line pt-2">
              <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">Related context</div>
              {artifact.related.map((r, i) => (
                <p key={i} className="text-[11.5px] text-mute">
                  {r}
                </p>
              ))}
            </div>
          )}
        </Frame>
      );

    case "security":
      return (
        <div className="flex items-start gap-3 rounded-2xl border border-danger/30 bg-danger/[0.06] p-3.5">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
          <div>
            <div className="text-[13px] font-medium text-ink">{artifact.message}</div>
            <p className="mt-0.5 text-xs text-mute">{artifact.detail}</p>
          </div>
        </div>
      );

    case "approval": {
      const a = approvals.find((x) => x.id === artifact.approvalId);
      return a ? <ApprovalCard approval={a} compact /> : null;
    }
  }
}

function InputRequest({ artifact, clone }: { artifact: Extract<Artifact, { kind: "input" }>; clone: CloneId }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const running = useClon((s) => s.running);
  return (
    <form
      className="rounded-2xl border border-accent-soft bg-accent-soft/30 p-3.5"
      style={{ "--accent": CLONES.communication.accent } as CSSProperties}
      onSubmit={(e) => {
        e.preventDefault();
        const email = value.trim();
        if (!EMAIL_RE.test(email)) {
          setError("Please enter a valid email address.");
          return;
        }
        setSent(true);
        void runCommand(clone, "", {
          resume: { token: artifact.token, input: { recipientEmail: email } },
          displayText: `${artifact.label}: ${email}`,
        });
      }}
    >
      <label className="mb-2 flex items-center gap-1.5 text-[12px] font-medium text-ink">
        <Mail className="h-3.5 w-3.5 text-accent" /> {artifact.label}
      </label>
      {artifact.hint && <p className="mb-2 text-[11px] text-mute">{artifact.hint}</p>}
      <div className="flex gap-2">
        <input
          type="email"
          className="field"
          placeholder={artifact.placeholder}
          value={value}
          disabled={sent}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          aria-invalid={!!error}
        />
        <Button type="submit" variant="accent" disabled={sent || !!running || !value}>
          Continue
        </Button>
      </div>
      {error && <p className="mt-1.5 text-[11px] text-danger">{error}</p>}
    </form>
  );
}
