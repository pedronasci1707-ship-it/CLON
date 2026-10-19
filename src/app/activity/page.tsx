"use client";

import { Download, Search, Trash } from "lucide-react";
import { useMemo, useState } from "react";
import { CLONES } from "@/lib/clones";
import { useClon } from "@/lib/store";
import type { CloneId, Outcome } from "@/lib/types";
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
  const [q, setQ] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

  const list = useMemo(
    () =>
      activity.filter(
        (a) =>
          (clone === "all" || a.clone === clone) &&
          (outcome === "all" || a.outcome === outcome) &&
          (!q || `${a.action} ${a.detail ?? ""}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [activity, clone, outcome, q],
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
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        title="Activity"
        action={
          <>
            <Button size="icon" variant="outline" onClick={exportJson} disabled={!activity.length} aria-label="Export" title="Export JSON">
              <Download className="h-4 w-4" />
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
                Confirm
              </Button>
            ) : (
              <Button size="icon" variant="ghost" onClick={() => setConfirmClear(true)} disabled={!activity.length} aria-label="Clear" title="Clear history">
                <Trash className="h-4 w-4" />
              </Button>
            )}
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total" value={hydrated ? activity.length : "—"} />
        <StatCard label="Real" value={hydrated ? activity.filter((a) => a.outcome === "success").length : "—"} />
        <StatCard label="Simulated" value={hydrated ? activity.filter((a) => a.outcome === "simulated").length : "—"} />
        <StatCard label="Blocked" value={hydrated ? activity.filter((a) => a.outcome === "blocked" || a.outcome === "error").length : "—"} />
      </div>

      <GlassPanel>
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <Segmented<CloneFilter>
            size="sm"
            label="Filter by clone"
            value={clone}
            onChange={setClone}
            options={[{ value: "all", label: "All" }, ...(Object.keys(CLONES) as CloneId[]).map((c) => ({ value: c, label: CLONES[c].short }))]}
          />
          <Segmented<OutcomeFilter>
            size="sm"
            label="Filter by outcome"
            value={outcome}
            onChange={setOutcome}
            options={[
              { value: "all", label: "Any" },
              { value: "success", label: "Real" },
              { value: "simulated", label: "Simulated" },
              { value: "pending", label: "Pending" },
              { value: "blocked", label: "Blocked" },
              { value: "error", label: "Errors" },
            ]}
          />
          <div className="relative w-full sm:ml-auto sm:w-52">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
            <input className="field pl-8" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search activity" />
          </div>
        </div>
        {hydrated ? <ActivityTimeline entries={list} /> : <div className="skeleton h-80 rounded-xl" />}
      </GlassPanel>
    </div>
  );
}
