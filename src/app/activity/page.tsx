"use client";

import { Download, Search, Trash } from "lucide-react";
import { useMemo, useState } from "react";
import { CLONES } from "@/lib/clones";
import { useClon } from "@/lib/store";
import type { CloneId, Mode, Outcome } from "@/lib/types";
import { ActivityTimeline } from "@/components/activity/ActivityTimeline";
import { Button } from "@/components/ui/Button";
import { Segmented, StatCard } from "@/components/ui/Controls";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { PageHeader } from "@/components/ui/PageHeader";

type CloneFilter = "all" | CloneId;
type OutcomeFilter = "all" | Outcome;

export default function ActivityPage() {
  const activity = useClon((s) => s.activity);
  const clear = useClon((s) => s.clearActivity);
  const hydrated = useClon((s) => s.hydrated);
  const [clone, setClone] = useState<CloneFilter>("all");
  const [outcome, setOutcome] = useState<OutcomeFilter>("all");
  const [mode, setMode] = useState<"all" | Mode>("all");
  const [q, setQ] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

  const list = useMemo(
    () =>
      activity.filter(
        (a) =>
          (clone === "all" || a.clone === clone) &&
          (outcome === "all" || a.outcome === outcome) &&
          (mode === "all" || a.mode === mode) &&
          (!q || `${a.action} ${a.detail ?? ""}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [activity, clone, outcome, mode, q],
  );

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(activity, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clon-activity-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader
        eyebrow="Audit trail"
        title="Activity"
        description="Every action by every clone — which service it touched, what happened, and whether it was real or simulated. Stored on this device."
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={exportJson} disabled={!activity.length}>
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
            {confirmClear ? (
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  clear();
                  setConfirmClear(false);
                }}
              >
                Confirm clear
              </Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setConfirmClear(true)} disabled={!activity.length}>
                <Trash className="h-3.5 w-3.5" /> Clear
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total events" value={hydrated ? activity.length : "—"} />
        <StatCard label="Real actions" value={hydrated ? activity.filter((a) => a.outcome === "success").length : "—"} hint="Verified against a connected service" />
        <StatCard label="Simulated" value={hydrated ? activity.filter((a) => a.outcome === "simulated").length : "—"} hint="Demo mode — nothing external changed" />
        <StatCard label="Blocked or failed" value={hydrated ? activity.filter((a) => a.outcome === "blocked" || a.outcome === "error").length : "—"} hint="Permissions, safety or service errors" />
      </div>

      <GlassPanel>
        <div className="mb-5 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Segmented<CloneFilter>
              size="sm"
              label="Filter by clone"
              value={clone}
              onChange={setClone}
              options={[{ value: "all", label: "All clones" }, ...(Object.keys(CLONES) as CloneId[]).map((c) => ({ value: c, label: CLONES[c].short }))]}
            />
            <div className="relative ml-auto w-full sm:w-60">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
              <input className="field pl-8" placeholder="Search actions" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search activity" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Segmented<OutcomeFilter>
              size="sm"
              label="Filter by outcome"
              value={outcome}
              onChange={setOutcome}
              options={[
                { value: "all", label: "Any outcome" },
                { value: "success", label: "Real" },
                { value: "simulated", label: "Simulated" },
                { value: "pending", label: "Awaiting you" },
                { value: "blocked", label: "Blocked" },
                { value: "error", label: "Errors" },
              ]}
            />
            <Segmented<"all" | Mode>
              size="sm"
              label="Filter by mode"
              value={mode}
              onChange={setMode}
              options={[
                { value: "all", label: "Both modes" },
                { value: "demo", label: "Demo" },
                { value: "live", label: "Live" },
              ]}
            />
          </div>
        </div>
        {hydrated ? <ActivityTimeline entries={list} showDetail /> : <div className="skeleton h-80 rounded-xl" />}
      </GlassPanel>
    </div>
  );
}
