"use client";

import { AnimatePresence, motion } from "motion/react";
import { CalendarClock, Check, Copy, ExternalLink, Inbox, Mail, PenLine, Reply, ShieldAlert, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { runCommand } from "@/lib/agent-client";
import { CLONES } from "@/lib/clones";
import { useInbox } from "@/lib/hooks";
import { useClon } from "@/lib/store";
import { timeAgo } from "@/lib/time";
import type { Autonomy, EmailMessage, UserProfile } from "@/lib/types";
import { cn, initials } from "@/lib/utils";
import { AgentWorkspace, AUTONOMY_LABEL } from "@/components/agent/AgentWorkspace";
import { Badge } from "@/components/ui/Badge";
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
          <StatCard accent={ACCENT} label="Unread" value={stats.unread} />
          <StatCard accent={ACCENT} label="To reply" value={<span className="text-accent">{stats.reply}</span>} />
          <StatCard accent={ACCENT} label="Meetings" value={stats.meetings} />
          <StatCard accent={ACCENT} label="Blocked" value={<span className={stats.flagged ? "text-danger" : ""}>{stats.flagged}</span>} />
        </>
      }
    >
      {/* Review studio */}
      <GlassPanel accent={ACCENT}>
        <SectionHeader title="Review" />
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
          title="Inbox"
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
              { value: "reply", label: `Reply · ${stats.reply}` },
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
          <EmptyState icon={Inbox} title="Nothing here" />
        ) : (
          <ul className="space-y-1">
            {visible.map((e) => (
              <li key={e.id}>
                <button
                  onClick={() => setSelectedId(e.id)}
                  title={e.snippet}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                    selected?.id === e.id ? "border-accent-soft bg-accent-soft" : "border-transparent hover:border-line hover:bg-white/[0.015]",
                    e.flagged && "border-danger/25",
                  )}
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[0.05] font-display text-[11px] text-soft">
                    {initials(e.from.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className={cn("truncate text-[13px]", e.unread ? "font-medium text-ink" : "text-soft")}>{e.from.name}</span>
                      {e.priority === "high" && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger" title="High priority" />}
                    </span>
                    <span className="block truncate text-[12.5px] text-mute">{e.subject}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 text-faint">
                    {e.needsReply && <Reply className="h-3.5 w-3.5 text-accent" aria-label="Needs reply" />}
                    {e.meetingRequest && <CalendarClock className="h-3.5 w-3.5 text-cyan" aria-label="Meeting request" />}
                    {drafts[e.id] && <PenLine className="h-3.5 w-3.5 text-violet" aria-label="Draft ready" />}
                    {e.flagged && <ShieldAlert className="h-3.5 w-3.5 text-danger" aria-label="Injection ignored" />}
                    <span className="w-12 text-right font-mono text-[10px]">{timeAgo(e.receivedAt)}</span>
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
    <div className="flex min-h-[280px] min-w-0 flex-col rounded-2xl border border-line bg-void/40 p-4">
      <div className="flex items-center gap-2 text-[13px] text-ink" title={email.from.email}>
        <Reply className="h-3.5 w-3.5 text-faint" /> {email.from.name}
        <span className="ml-auto font-mono text-[10px] text-faint">{timeAgo(email.receivedAt)}</span>
      </div>
      <h3 className="mt-2 font-display text-base text-ink">{email.subject}</h3>
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
    <div className="relative flex min-h-[280px] min-w-0 flex-col overflow-hidden rounded-2xl border border-accent-soft bg-accent-soft/30 p-4">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-accent" title="CLON never sends email on its own.">
        <Sparkles className="h-3 w-3" /> Draft
        {draft && (
          <span className="ml-auto">
            {draft.status === "created" ? (
              <Badge tone="ok">Saved · not sent</Badge>
            ) : draft.status === "simulated" ? (
              <Badge tone="violet">Simulated</Badge>
            ) : draft.status === "pending_approval" ? (
              <Badge tone="cyan">Awaiting you</Badge>
            ) : (
              <Badge tone="warn">{draft.status}</Badge>
            )}
          </span>
        )}
      </div>
      <AnimatePresence mode="wait">
        {draft ? (
          <motion.div key={draft.at} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-1 flex-col">
            <div className="mt-3 truncate text-[13px] text-ink">{draft.to}</div>
            <h3 className="mt-1 font-display text-base text-ink">{draft.subject}</h3>
            <p className="mt-3 flex-1 whitespace-pre-line text-[13px] leading-relaxed text-soft">{draft.body}</p>
            <div className="mt-4 flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                aria-label={copied ? "Copied" : "Copy draft"}
                title={copied ? "Copied" : "Copy"}
                onClick={async () => {
                  await navigator.clipboard?.writeText(`${draft.subject}\n\n${draft.body}`);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? <Check className="h-4 w-4 text-ok" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Redraft"
                title="Redraft"
                disabled={busy}
                onClick={() => runCommand("communication", `Draft a reply to ${firstName} with times I'm free`)}
              >
                <PenLine className="h-4 w-4" />
              </Button>
              {draft.link && (
                <a
                  href={draft.link}
                  target="_blank"
                  rel="noreferrer"
                  className="grid h-9 w-9 place-items-center rounded-xl text-accent hover:bg-white/[0.05]"
                  aria-label="Open Gmail drafts"
                  title="Open Gmail drafts"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            {email.flagged ? (
              <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-danger/80" title="CLON won't draft replies to messages that try to instruct it.">
                <ShieldAlert className="h-3.5 w-3.5" /> Review yourself
              </span>
            ) : canDraft ? (
              <Button
                variant="accent"
                size="sm"
                disabled={busy}
                title={email.meetingRequest ? "Checks your real availability before proposing times" : undefined}
                onClick={() => runCommand("communication", `Draft a reply to ${firstName}${email.meetingRequest ? " with times I'm free" : ""}`)}
              >
                <PenLine className="h-3.5 w-3.5" /> Draft reply
              </Button>
            ) : (
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">No reply needed</span>
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

  return (
    <GlassPanel accent={ACCENT}>
      <SectionHeader title="Preferences" />
      <div className="flex flex-wrap gap-x-8 gap-y-5">
        <div>
          <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-faint">Style</div>
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
        </div>
        <div title={AUTONOMY_HELP[perm.autonomy]}>
          <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-faint">Autonomy</div>
          <Segmented<Autonomy>
            label="Autonomy level"
            value={perm.autonomy}
            onChange={(a) => setPermission("communication", { autonomy: a })}
            options={(Object.keys(AUTONOMY_LABEL) as Autonomy[]).map((a) => ({ value: a, label: AUTONOMY_LABEL[a] }))}
          />
        </div>
      </div>
    </GlassPanel>
  );
}
