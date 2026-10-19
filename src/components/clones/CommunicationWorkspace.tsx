"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, Copy, Inbox, Mail, PenLine, Reply, ShieldAlert, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { runCommand } from "@/lib/agent-client";
import { CLONES } from "@/lib/clones";
import { useInbox } from "@/lib/hooks";
import { useClon } from "@/lib/store";
import { timeAgo } from "@/lib/time";
import type { Autonomy, EmailMessage, UserProfile } from "@/lib/types";
import { cn, initials } from "@/lib/utils";
import { AgentWorkspace, AUTONOMY_LABEL } from "@/components/agent/AgentWorkspace";
import { Badge, ModeBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Segmented, StatCard } from "@/components/ui/Controls";
import { GlassPanel, SectionHeader } from "@/components/ui/GlassPanel";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";

const ACCENT = CLONES.communication.accent;

type Filter = "all" | "reply" | "work" | "personal" | "flagged";

const AUTONOMY_HELP: Record<Autonomy, string> = {
  read_only: "Analyzes and summarizes. Never writes anything.",
  draft: "Prepares drafts in your mailbox. Never sends.",
  approval: "Prepares drafts only after you approve each one.",
  limited: "Can act on narrowly defined, low-risk cases you allow. Sending still needs you.",
};

export function CommunicationWorkspace() {
  const inbox = useInbox();
  const drafts = useClon((s) => s.drafts);
  const running = useClon((s) => s.running);
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const emails = useMemo(() => [...inbox.emails].sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt)), [inbox.emails]);
  const visible = emails.filter((e) =>
    filter === "all" ? true : filter === "reply" ? e.needsReply : filter === "flagged" ? !!e.flagged : e.category === filter,
  );
  const selected = emails.find((e) => e.id === selectedId) ?? emails.find((e) => e.meetingRequest) ?? emails[0];
  const draft = selected ? drafts[selected.id] : undefined;

  const stats = {
    unread: emails.filter((e) => e.unread).length,
    reply: emails.filter((e) => e.needsReply).length,
    meetings: emails.filter((e) => e.meetingRequest).length,
    flagged: emails.filter((e) => e.flagged).length,
  };

  return (
    <AgentWorkspace
      clone="communication"
      summary={
        <>
          <StatCard accent={ACCENT} label="Unread" value={stats.unread} hint={`${emails.length} in view`} />
          <StatCard accent={ACCENT} label="Need a reply" value={<span className="text-accent">{stats.reply}</span>} hint="Questions waiting on you" />
          <StatCard accent={ACCENT} label="Meeting requests" value={stats.meetings} hint="Checked against your calendar" />
          <StatCard accent={ACCENT} label="Blocked instructions" value={<span className={stats.flagged ? "text-danger" : ""}>{stats.flagged}</span>} hint="Prompt-injection attempts ignored" />
        </>
      }
    >
      {/* Review studio */}
      <GlassPanel accent={ACCENT}>
        <SectionHeader
          eyebrow="Review studio"
          title="Original on the left, your clone's draft on the right"
          action={inbox.source === "gmail" ? <ModeBadge mode="live" /> : <ModeBadge mode="demo" />}
        />
        {inbox.loading ? (
          <LoadingState lines={4} />
        ) : !selected ? (
          <EmptyState icon={Mail} title="No email selected" />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            <EmailPane email={selected} />
            <DraftPane email={selected} draft={draft} busy={!!running} />
          </div>
        )}
      </GlassPanel>

      {/* Inbox */}
      <GlassPanel accent={ACCENT}>
        <SectionHeader
          eyebrow={inbox.source === "gmail" ? "Gmail · read via Composio" : "Demo inbox"}
          title="Important communications"
          action={
            <Button size="sm" variant="ghost" disabled={!!running} onClick={() => runCommand("communication", "Summarize my unread emails")}>
              <Sparkles className="h-3.5 w-3.5" /> Triage
            </Button>
          }
        />
        <div className="mb-3">
          <Segmented<Filter>
            size="sm"
            label="Filter inbox"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All" },
              { value: "reply", label: `Needs reply · ${stats.reply}` },
              { value: "work", label: "Work" },
              { value: "personal", label: "Personal" },
              { value: "flagged", label: `Flagged · ${stats.flagged}` },
            ]}
          />
        </div>
        {inbox.error ? (
          <ErrorState title="Couldn't read Gmail" body={inbox.error} />
        ) : inbox.loading ? (
          <LoadingState lines={5} />
        ) : visible.length === 0 ? (
          <EmptyState icon={Inbox} title="Nothing here" body="No messages match this filter." />
        ) : (
          <ul className="space-y-1.5">
            {visible.map((e) => (
              <li key={e.id}>
                <button
                  onClick={() => setSelectedId(e.id)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                    selected?.id === e.id ? "border-accent-soft bg-accent-soft" : "border-line bg-white/[0.015] hover:border-line-strong",
                    e.flagged && "border-danger/25",
                  )}
                >
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[0.05] font-display text-[11px] text-soft">
                    {initials(e.from.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className={cn("truncate text-[13px]", e.unread ? "font-medium text-ink" : "text-soft")}>{e.from.name}</span>
                      {e.priority === "high" && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger" title="High priority" />}
                      <span className="ml-auto shrink-0 font-mono text-[10px] text-faint">{timeAgo(e.receivedAt)}</span>
                    </span>
                    <span className="block truncate text-[12.5px] text-soft">{e.subject}</span>
                    <span className="block truncate text-[11.5px] text-mute">{e.snippet}</span>
                    <span className="mt-1.5 flex flex-wrap gap-1">
                      <Badge>{e.category}</Badge>
                      {e.needsReply && <Badge tone="accent">Needs reply</Badge>}
                      {e.meetingRequest && <Badge tone="cyan">Meeting request</Badge>}
                      {drafts[e.id] && <Badge tone="violet">Draft ready</Badge>}
                      {e.flagged && (
                        <Badge tone="danger">
                          <ShieldAlert className="h-2.5 w-2.5" /> Injection ignored
                        </Badge>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </GlassPanel>

      <PreferencesPanel />
    </AgentWorkspace>
  );
}

function EmailPane({ email }: { email: EmailMessage }) {
  return (
    <div className="flex min-h-[300px] min-w-0 flex-col rounded-2xl border border-line bg-void/40 p-4">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
        <Reply className="h-3 w-3" /> Original · {timeAgo(email.receivedAt)}
      </div>
      <div className="mt-3 text-[13px] text-mute">
        From <span className="text-ink">{email.from.name}</span> <span className="text-faint">&lt;{email.from.email}&gt;</span>
      </div>
      <h3 className="mt-1 font-display text-base text-ink">{email.subject}</h3>
      {email.flagged && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/[0.07] p-2.5 text-xs text-danger/90">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {email.flagged}
        </div>
      )}
      <p className="mt-3 whitespace-pre-line text-[13px] leading-relaxed text-soft">{email.body}</p>
    </div>
  );
}

function DraftPane({
  email,
  draft,
  busy,
}: {
  email: EmailMessage;
  draft?: { to: string; subject: string; body: string; status: string; mode: string; at: string; link?: string };
  busy: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const firstName = email.from.name.split(" ")[0];
  const canDraft = !email.flagged && email.needsReply;

  return (
    <div className="relative flex min-h-[300px] min-w-0 flex-col overflow-hidden rounded-2xl border border-accent-soft bg-accent-soft/30 p-4">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-accent">
        <Sparkles className="h-3 w-3" /> Draft by your clone
        {draft && (
          <span className="ml-auto">
            {draft.status === "created" ? (
              <Badge tone="ok">Saved in Gmail · not sent</Badge>
            ) : draft.status === "simulated" ? (
              <Badge tone="violet">Simulated · not sent</Badge>
            ) : draft.status === "pending_approval" ? (
              <Badge tone="cyan">Awaiting approval</Badge>
            ) : (
              <Badge tone="warn">{draft.status}</Badge>
            )}
          </span>
        )}
      </div>
      <AnimatePresence mode="wait">
        {draft ? (
          <motion.div key={draft.at} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-1 flex-col">
            <div className="mt-3 text-[13px] text-mute">
              To <span className="text-ink">{draft.to}</span>
            </div>
            <h3 className="mt-1 font-display text-base text-ink">{draft.subject}</h3>
            <p className="mt-3 flex-1 whitespace-pre-line text-[13px] leading-relaxed text-soft">{draft.body}</p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await navigator.clipboard?.writeText(`${draft.subject}\n\n${draft.body}`);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => runCommand("communication", `Draft a reply to ${firstName} with times I'm free`)}>
                <PenLine className="h-3.5 w-3.5" /> Redraft
              </Button>
              {draft.link && (
                <a href={draft.link} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline">
                  Open Gmail drafts →
                </a>
              )}
              <span className="ml-auto text-[11px] text-faint">CLON never sends email on its own.</span>
            </div>
          </motion.div>
        ) : (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            {email.flagged ? (
              <p className="max-w-xs text-xs text-mute">CLON won&apos;t draft replies to messages that try to instruct it. Review this one yourself.</p>
            ) : canDraft ? (
              <>
                <p className="max-w-xs text-xs text-mute">
                  {email.meetingRequest
                    ? "This looks like a meeting request. Your clone will check your real availability before proposing times."
                    : "Your clone can draft a reply in your writing style for you to review."}
                </p>
                <Button variant="accent" size="sm" disabled={busy} onClick={() => runCommand("communication", `Draft a reply to ${firstName}${email.meetingRequest ? " with times I'm free" : ""}`)}>
                  <PenLine className="h-3.5 w-3.5" /> Draft reply
                </Button>
              </>
            ) : (
              <p className="max-w-xs text-xs text-mute">No reply needed for this message.</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      {busy && <div className="scanlines pointer-events-none absolute inset-0 animate-pulse-soft opacity-40" />}
    </div>
  );
}

function PreferencesPanel() {
  const profile = useClon((s) => s.profile);
  const perm = useClon((s) => s.permissions.communication);
  const updateProfile = useClon((s) => s.updateProfile);
  const setPermission = useClon((s) => s.setPermission);
  const system = useClon((s) => s.system);
  const mode = useClon((s) => s.mode);

  return (
    <GlassPanel accent={ACCENT}>
      <SectionHeader eyebrow="Preferences & control" title="How this clone writes and acts" />
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <div className="mb-2 text-xs font-medium text-soft">Writing style</div>
          <Segmented<UserProfile["commStyle"]>
            label="Writing style"
            value={profile.commStyle}
            onChange={(v) => updateProfile({ commStyle: v })}
            options={[
              { value: "concise", label: "Concise" },
              { value: "warm", label: "Warm" },
              { value: "formal", label: "Formal" },
            ]}
          />
          <div className="mb-2 mt-5 text-xs font-medium text-soft">Connections</div>
          <ul className="space-y-1.5 text-xs">
            <li className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 text-mute" /> Gmail
              <span className="ml-auto">
                {system?.composio.accounts.gmail === "connected" ? <Badge tone="ok">Connected</Badge> : <Badge>Not connected</Badge>}
              </span>
            </li>
            <li className="text-[11px] text-faint">
              {mode === "demo" ? "Demo mode: reading a seeded inbox. Nothing real is read or written." : "Live mode: reading Gmail through Composio."}
            </li>
          </ul>
        </div>
        <div>
          <div className="mb-2 text-xs font-medium text-soft">Autonomy level</div>
          <div className="space-y-1.5">
            {(Object.keys(AUTONOMY_LABEL) as Autonomy[]).map((a) => (
              <label
                key={a}
                className={cn(
                  "flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2 transition-colors",
                  perm.autonomy === a ? "border-accent-soft bg-accent-soft" : "border-line hover:border-line-strong",
                )}
              >
                <input
                  type="radio"
                  name="comm-autonomy"
                  className="mt-0.5 accent-[var(--accent)]"
                  checked={perm.autonomy === a}
                  onChange={() => setPermission("communication", { autonomy: a })}
                />
                <span>
                  <span className="block text-[13px] text-ink">
                    {AUTONOMY_LABEL[a]} {a === "draft" && <span className="text-[11px] text-faint">· default</span>}
                  </span>
                  <span className="block text-[11.5px] text-mute">{AUTONOMY_HELP[a]}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}
