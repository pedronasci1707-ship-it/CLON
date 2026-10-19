"use client";

import { Ban, CalendarPlus, Mail, ShieldCheck, Trash, Wallet } from "lucide-react";
import { useClon } from "@/lib/store";
import { usePendingApprovals } from "@/lib/hooks";
import { ApprovalCard } from "@/components/approvals/ApprovalCard";
import { GlassPanel, SectionHeader } from "@/components/ui/GlassPanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, LoadingState } from "@/components/ui/States";

const POLICY = [
  { icon: CalendarPlus, title: "Calendar changes", body: "Creating or moving events always waits for your approval — for every clone." },
  { icon: Mail, title: "Email drafts", body: "Drafted only when the Communication clone's autonomy allows it. CLON never sends email on its own." },
  { icon: Wallet, title: "Money", body: "No clone can buy, book or pay for anything." },
  { icon: Trash, title: "Deleting", body: "No clone can delete your emails, events or files." },
  { icon: Ban, title: "Untrusted content", body: "Instructions found inside emails or web pages are ignored and flagged." },
];

export default function ApprovalsPage() {
  const approvals = useClon((s) => s.approvals);
  const hydrated = useClon((s) => s.hydrated);
  const pending = usePendingApprovals();
  const history = approvals.filter((a) => a.status !== "pending");

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader
        eyebrow="Human in the loop"
        title="Approvals"
        description="Your clones prepare; you decide. Nothing below reaches your calendar, inbox or other people until you approve it."
      />
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-8">
          <GlassPanel>
            <SectionHeader eyebrow="Waiting for you" title={pending.length ? `${pending.length} pending` : "Nothing pending"} />
            {!hydrated ? (
              <LoadingState lines={3} />
            ) : pending.length ? (
              <div className="space-y-3">
                {pending.map((a) => (
                  <ApprovalCard key={a.id} approval={a} />
                ))}
              </div>
            ) : (
              <EmptyState icon={ShieldCheck} title="You're all caught up" body="When a clone wants to change something, it will ask here first." />
            )}
          </GlassPanel>

          {history.length > 0 && (
            <GlassPanel>
              <SectionHeader eyebrow="History" title="Decided actions" />
              <div className="space-y-3">
                {history.slice(0, 20).map((a) => (
                  <ApprovalCard key={a.id} approval={a} compact />
                ))}
              </div>
            </GlassPanel>
          )}
        </div>

        <GlassPanel className="h-fit lg:col-span-4">
          <SectionHeader eyebrow="Policy" title="What always needs you" />
          <ul className="space-y-4">
            {POLICY.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-line bg-white/[0.03]">
                  <Icon className="h-4 w-4 text-cyan" strokeWidth={1.6} />
                </span>
                <div>
                  <div className="text-[13px] font-medium text-ink">{title}</div>
                  <p className="text-xs leading-relaxed text-mute">{body}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-5 border-t border-line pt-4 text-[11px] text-faint">
            The Master Clone can&apos;t override a specialist&apos;s permissions, and “do whatever is necessary” doesn&apos;t bypass these rules.
          </p>
        </GlassPanel>
      </div>
    </div>
  );
}
