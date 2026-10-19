"use client";

import { Brain, CalendarDays, Globe, LoaderCircle, Mail, RefreshCw } from "lucide-react";
import { useState } from "react";
import { errorMessage } from "@/lib/agent-client";
import { useClon } from "@/lib/store";
import type { SystemStatus } from "@/lib/types";
import { IntegrationCard, type ConnectionState } from "@/components/integrations/IntegrationCard";
import { MemoryPanel } from "@/components/integrations/MemoryPanel";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Controls";
import { GlassPanel, SectionHeader } from "@/components/ui/GlassPanel";
import { PageHeader } from "@/components/ui/PageHeader";

type Toolkit = "gmail" | "googlecalendar";

function accountState(system: SystemStatus | null, key: Toolkit): ConnectionState {
  if (!system) return "checking";
  if (!system.composio.configured) return "not_configured";
  const s = system.composio.accounts[key];
  return s === "connected" ? "connected" : s === "error" ? "error" : "not_connected";
}

export default function IntegrationsPage() {
  const system = useClon((s) => s.system);
  const setSystem = useClon((s) => s.setSystem);
  const mode = useClon((s) => s.mode);
  const setMode = useClon((s) => s.setMode);
  const disabled = useClon((s) => s.disabledIntegrations);
  const toggle = useClon((s) => s.toggleIntegration);
  const notify = useClon((s) => s.notify);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setBusy("refresh");
    try {
      const r = await fetch("/api/system/status?refresh=1", { cache: "no-store" });
      const data = await r.json().catch(() => null);
      if (!r.ok) throw new Error(errorMessage(data, "Status check failed"));
      setSystem(data as SystemStatus);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const connect = async (toolkit: Toolkit) => {
    setBusy(toolkit);
    setError(null);
    try {
      const r = await fetch("/api/integrations/connect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ toolkit }),
      });
      const data = (await r.json().catch(() => null)) as { redirectUrl?: string | null } | null;
      if (!r.ok) throw new Error(errorMessage(data, "Could not start the connection"));
      if (data?.redirectUrl) {
        window.open(data.redirectUrl, "_blank", "noopener,noreferrer");
        notify({ kind: "update", title: "Finish connecting in the new tab", body: "Then come back and press “Refresh status”.", href: "/integrations" });
      } else {
        await refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const composioAction = (toolkit: Toolkit) => {
    const state = accountState(system, toolkit);
    if (state === "not_configured") return <p className="font-mono text-[10px] text-faint">Needs COMPOSIO_API_KEY</p>;
    if (state === "connected") return null;
    return (
      <Button variant="accent" size="sm" className="w-full" disabled={busy !== null} onClick={() => connect(toolkit)} title="Opens Composio in a new tab">
        {busy === toolkit ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null} Connect
      </Button>
    );
  };

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        title="Apps"
        action={
          <Button size="icon" variant="outline" onClick={refresh} disabled={busy !== null} aria-label="Refresh status" title="Refresh status">
            <RefreshCw className={busy === "refresh" ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          </Button>
        }
      />

      <GlassPanel className="mb-6">
        <div
          className="flex items-center gap-4"
          title="Demo never reads or changes anything real. Live uses your connected accounts and never falls back to demo data."
        >
          <SectionHeader title="Mode" className="mb-0" />
          <div className="ml-auto">
            <Segmented<"demo" | "live">
              label="Data mode"
              value={mode}
              onChange={(m) => {
                if (m === "live" && !system?.liveAvailable) {
                  setError("Connect Google Calendar or Gmail first.");
                  return;
                }
                setMode(m);
              }}
              options={[
                { value: "demo", label: "Demo" },
                { value: "live", label: "Live" },
              ]}
            />
          </div>
        </div>
        {error && <p className="mt-3 rounded-xl border border-danger/25 bg-danger/[0.06] px-3 py-2 text-xs text-danger">{error}</p>}
        {system?.composio.error && (
          <p className="mt-3 rounded-xl border border-warn/25 bg-warn/[0.06] px-3 py-2 text-xs text-warn">Composio: {system.composio.error}</p>
        )}
      </GlassPanel>

      <div className="grid gap-5 sm:grid-cols-2">
        <IntegrationCard
          icon={CalendarDays}
          name="Calendar"
          provider="Google Calendar via Composio"
          accent="#5be7f5"
          state={accountState(system, "googlecalendar")}
          enabled={!disabled.includes("googlecalendar")}
          onToggle={() => toggle("googlecalendar")}
          action={composioAction("googlecalendar")}
        />
        <IntegrationCard
          icon={Mail}
          name="Gmail"
          provider="Gmail via Composio · reads and drafts, never sends"
          accent="#5aa8ff"
          state={accountState(system, "gmail")}
          enabled={!disabled.includes("gmail")}
          onToggle={() => toggle("gmail")}
          action={composioAction("gmail")}
        />
        <IntegrationCard
          icon={Globe}
          name="Web research"
          provider="Parallel · sourced events and places"
          accent="#3fd8c4"
          state={!system ? "checking" : system.parallel.configured ? "configured" : "not_configured"}
          enabled={!disabled.includes("parallel")}
          onToggle={() => toggle("parallel")}
          footnote={system?.parallel.configured ? undefined : "Needs PARALLEL_API_KEY"}
        />
        <IntegrationCard
          icon={Brain}
          name="Model"
          provider={
            system?.llm.configured
              ? system.llm.model ?? "OpenAI-compatible"
              : "Optional · any OpenAI-compatible endpoint. Without one, CLON uses its rules planner."
          }
          accent="#9879ff"
          state={!system ? "checking" : system.llm.configured ? "configured" : "not_configured"}
          footnote={system?.llm.configured ? undefined : "Needs OPENAI_MODEL + key"}
        />
      </div>

      <MemoryPanel />

      <GlassPanel className="mt-6">
        <SectionHeader title="Soon" eyebrow="Planned — not connected" />
        <div className="flex flex-wrap gap-2">
          {["Slack", "Outlook", "Notion", "Drive", "Linear", "Strava", "Health Connect", "Apple Health"].map((name) => (
            <span key={name} className="rounded-full border border-dashed border-line px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
              {name}
            </span>
          ))}
        </div>
      </GlassPanel>
    </div>
  );
}
