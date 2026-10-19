"use client";

import { Download, RotateCcw } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { CLONES, SPECIALISTS } from "@/lib/clones";
import { useClon } from "@/lib/store";
import type { Autonomy, CalendarAccess, UserProfile } from "@/lib/types";
import { AUTONOMY_LABEL, CALENDAR_LABEL } from "@/components/agent/AgentWorkspace";
import { Button } from "@/components/ui/Button";
import { CloneSigil } from "@/components/ui/CloneSigil";
import { Field, Segmented, Switch } from "@/components/ui/Controls";
import { GlassPanel, SectionHeader } from "@/components/ui/GlassPanel";
import { PageHeader } from "@/components/ui/PageHeader";

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hourLabel = (h: number) => `${h % 12 || 12}:00 ${h < 12 ? "AM" : "PM"}`;

export default function SettingsPage() {
  const profile = useClon((s) => s.profile);
  const hydrated = useClon((s) => s.hydrated);
  const updateProfile = useClon((s) => s.updateProfile);

  const [draft, setDraft] = useState<UserProfile>(profile);
  useEffect(() => setDraft(profile), [profile, hydrated]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(profile);

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader title="Settings" />

      <div className="space-y-5">
        <GlassPanel>
          <SectionHeader title="Profile" />
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              updateProfile({ ...draft, name: draft.name.trim() || profile.name, city: draft.city.trim() || profile.city });
            }}
          >
            <Field label="Name">
              <input className="field" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </Field>
            <Field label="City">
              <input className="field" value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} />
            </Field>
            <Field label="Workday starts">
              <select className="field" value={draft.workdayStart} onChange={(e) => setDraft({ ...draft, workdayStart: Number(e.target.value) })}>
                {HOURS.slice(5, 13).map((h) => (
                  <option key={h} value={h}>
                    {hourLabel(h)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Workday ends">
              <select className="field" value={draft.workdayEnd} onChange={(e) => setDraft({ ...draft, workdayEnd: Number(e.target.value) })}>
                {HOURS.slice(14, 23).map((h) => (
                  <option key={h} value={h}>
                    {hourLabel(h)}
                  </option>
                ))}
              </select>
            </Field>
            <div>
              <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-faint">Writing style</div>
              <Segmented<UserProfile["commStyle"]>
                label="Writing style"
                value={draft.commStyle}
                onChange={(v) => setDraft({ ...draft, commStyle: v })}
                options={[
                  { value: "concise", label: "Concise" },
                  { value: "warm", label: "Warm" },
                  { value: "formal", label: "Formal" },
                ]}
              />
            </div>
            <Field label="Interests">
              <input
                className="field"
                placeholder="music, AI, hiking"
                value={draft.interests.join(", ")}
                onChange={(e) => setDraft({ ...draft, interests: e.target.value.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 12) })}
              />
            </Field>
            <div className="flex items-center gap-2 md:col-span-2">
              <Button type="submit" variant="primary" size="sm" disabled={!dirty}>
                Save
              </Button>
              {dirty && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setDraft(profile)}>
                  Discard
                </Button>
              )}
            </div>
          </form>
        </GlassPanel>

        <PermissionsPanel />
        <DataPanel />
      </div>
    </div>
  );
}

function PermissionsPanel() {
  const permissions = useClon((s) => s.permissions);
  const setPermission = useClon((s) => s.setPermission);
  const record = useClon((s) => s.recordActivity);
  const mode = useClon((s) => s.mode);

  return (
    <GlassPanel id="permissions">
      <SectionHeader title="Permissions" eyebrow="Calendar changes always require approval. Sending email is never automated." />
      <div className="space-y-3">
        {SPECIALISTS.map((id) => {
          const def = CLONES[id];
          const p = permissions[id];
          return (
            <div
              key={id}
              className="grid gap-3 rounded-2xl border border-line bg-white/[0.015] p-4 md:grid-cols-[minmax(160px,1fr)_auto_auto_auto] md:items-center"
              style={{ "--accent": def.accent } as CSSProperties}
            >
              <div className="flex items-center gap-3">
                <CloneSigil clone={id} size={36} />
                <div className="text-[14px] text-ink">{def.short}</div>
              </div>
              <label>
                <span className="sr-only">Autonomy</span>
                <select
                  className="field min-w-[170px]"
                  value={p.autonomy}
                  onChange={(e) => {
                    setPermission(id, { autonomy: e.target.value as Autonomy });
                    record({ clone: id, action: `Autonomy set to “${AUTONOMY_LABEL[e.target.value as Autonomy]}”`, service: "system", mode, outcome: "success" });
                  }}
                >
                  {(Object.keys(AUTONOMY_LABEL) as Autonomy[]).map((a) => (
                    <option key={a} value={a}>
                      {AUTONOMY_LABEL[a]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="sr-only">Calendar</span>
                <select
                  className="field min-w-[200px]"
                  value={p.calendar}
                  onChange={(e) => setPermission(id, { calendar: e.target.value as CalendarAccess })}
                >
                  {(Object.keys(CALENDAR_LABEL) as CalendarAccess[]).map((c) => (
                    <option key={c} value={c}>
                      {CALENDAR_LABEL[c]}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-center md:justify-end">
                <Switch
                  checked={p.enabled}
                  onChange={(v) => {
                    setPermission(id, { enabled: v });
                    record({ clone: id, action: v ? "Clone re-enabled" : "Clone paused", service: "system", mode, outcome: "success" });
                  }}
                  label={`Enable ${def.name}`}
                  accent={def.accent}
                />
              </div>
              {id === "work" && (
                <label className="flex items-center gap-3 text-xs text-mute md:col-span-4">
                  <Switch
                    checked={!!p.shareContext}
                    onChange={(v) => setPermission("work", { shareContext: v })}
                    label="Share work event titles with other clones"
                    accent={def.accent}
                  />
                  <span title="When off, Life and Fitness only see “Busy”.">Share work titles</span>
                </label>
              )}
            </div>
          );
        })}
      </div>
    </GlassPanel>
  );
}

function DataPanel() {
  const seed = useClon((s) => s.seed);
  const notify = useClon((s) => s.notify);
  const [confirm, setConfirm] = useState(false);

  const exportAll = () => {
    const {
      hydrated: _h,
      running: _r,
      system: _s,
      ...rest
    } = useClon.getState();
    const data = Object.fromEntries(Object.entries(rest).filter(([, v]) => typeof v !== "function"));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clon-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <GlassPanel>
      <SectionHeader
        title="Data"
        eyebrow="Profile, permissions, tasks, logged workouts, your notes, conversations and the activity log are kept in this browser. Connected-account tokens never reach it."
      />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={exportAll}>
          <Download className="h-3.5 w-3.5" /> Export
        </Button>
        {confirm ? (
          <>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                seed(true);
                setConfirm(false);
                notify({ kind: "update", title: "Demo world reset", body: "Seeded data, conversations and settings were restored." });
              }}
            >
              Confirm reset
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setConfirm(true)}>
            <RotateCcw className="h-3.5 w-3.5" /> Reset demo
          </Button>
        )}
      </div>
    </GlassPanel>
  );
}
