"use client";

import { Ban, CalendarPlus, Mail, ShieldCheck, Trash, Wallet } from "lucide-react";
import { useClon } from "@/lib/store";
import { usePendingApprovals } from "@/lib/hooks";
import { ApprovalCard } from "@/components/approvals/ApprovalCard";
import { GlassPanel, SectionHeader } from "@/components/ui/GlassPanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, LoadingState } from "@/components/ui/States";

/** The guardrails, one line each — the full wording is the tooltip. */
const POLICY = [
  { icon: CalendarPlus, label: "Calendar", rule: "asks first", tone: "text-cyan", body: "Creating or moving events always waits for your approval — for every clone." },
  { icon: Mail, label: "Email", rule: "never sent", tone: "text-cyan", body: "Drafted only when the Communication clone's autonomy allows it. CLON never sends email on its own." },
  { icon: Wallet, label: "Payments", rule: "blocked", tone: "text-warn", body: "No clone can buy, book or pay for anything." },
  { icon: Trash, label: "Deleting", rule: "blocked", tone: "text-warn", body: "No clone can delete your emails, events or files." },
  { icon: Ban, label: "Injected instructions", rule: "ignored", tone: "text-warn", body: "Instructions found inside emails or web pages are ignored and flagged." },
];

export default function ApprovalsPage() {
  const approvals = useClon((s) => s.approvals);
  const hydrated = useClon((s) => s.hydrated);
  const pending = usePendingApprovals();
  const history = approvals.filter((a) => a.status !== "pending");

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader title="Approvals" />
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-8">
          <GlassPanel>
            <SectionHeader title="Pending" count={pending.length} />
            {!hydrated ? (
              <LoadingState lines={3} />
            ) : pending.length ? (
              <div className="space-y-3">
                {pending.map((a) => (
                  <ApprovalCard key={a.id} approval={a} />
                ))}
              </div>
            ) : (
              <EmptyState icon={ShieldCheck} title="All clear" />
            )}
          </GlassPanel>

          {history.length > 0 && (
            <GlassPanel>
              <SectionHeader title="History" />
              <div className="space-y-3">
                {history.slice(0, 20).map((a) => (
                  <ApprovalCard key={a.id} approval={a} compact />
                ))}
              </div>
            </GlassPanel>
          )}
        </div>

        <GlassPanel className="h-fit lg:col-span-4">
          <SectionHeader title="Rules" eyebrow="The Master Clone can't override these, and “do whatever is necessary” doesn't bypass them." />
          <ul className="space-y-1">
            {POLICY.map(({ icon: Icon, label, rule, tone, body }) => (
              <li key={label} title={body} className="flex items-center gap-3 rounded-xl px-1 py-2">
                <Icon className="h-4 w-4 shrink-0 text-mute" strokeWidth={1.6} />
                <span className="min-w-0 flex-1 truncate text-[13px] text-soft">{label}</span>
                <span className={`shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] ${tone}`}>{rule}</span>
              </li>
            ))}
          </ul>
        </GlassPanel>
      </div>
    </div>
  );
}
