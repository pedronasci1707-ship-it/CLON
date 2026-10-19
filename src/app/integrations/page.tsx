"use client";

import {
  BookOpen,
  Brain,
  CalendarDays,
  Code,
  FileText,
  Globe,
  HeartPulse,
  LoaderCircle,
  Mail,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { useState } from "react";
import { errorMessage } from "@/lib/agent-client";
import { useClon } from "@/lib/store";
import type { SystemStatus } from "@/lib/types";
import { IntegrationCard, type ConnectionState } from "@/components/integrations/IntegrationCard";
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
    if (state === "not_configured")
      return <p className="text-[11px] text-faint">Set COMPOSIO_API_KEY on the server to enable connecting.</p>;
    if (state === "connected") return null;
    return (
      <Button variant="accent" size="sm" className="w-full" disabled={busy !== null} onClick={() => connect(toolkit)}>
        {busy === toolkit ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null} Connect with Composio
      </Button>
    );
  };

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader
        eyebrow="Connected apps"
        title="Integrations"
        description="CLON works fully in Demo mode with no accounts. Connect apps to let your clones read and prepare real things — tokens stay on the server, and changes still need your approval."
        action={
          <Button size="sm" variant="outline" onClick={refresh} disabled={busy !== null}>
            <RefreshCw className={busy === "refresh" ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} /> Refresh status
          </Button>
        }
      />

      <GlassPanel className="mb-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="min-w-0 flex-1">
            <SectionHeader eyebrow="Data mode" title={mode === "live" ? "Live — using connected accounts" : "Demo — seeded data, simulated actions"} className="mb-1" />
            <p className="text-xs leading-relaxed text-mute">
              Demo mode never reads or changes anything real and labels every result. Live mode uses your connected accounts, shows real tool results and never
              falls back to demo data when something fails.
            </p>
          </div>
          <Segmented<"demo" | "live">
            label="Data mode"
            value={mode}
            onChange={(m) => {
              if (m === "live" && !system?.liveAvailable) {
                setError("Live mode needs Composio configured and Gmail or Google Calendar connected.");
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
        {error && <p className="mt-3 rounded-xl border border-danger/25 bg-danger/[0.06] px-3 py-2 text-xs text-danger">{error}</p>}
        {system?.composio.error && (
          <p className="mt-3 rounded-xl border border-warn/25 bg-warn/[0.06] px-3 py-2 text-xs text-warn">Composio: {system.composio.error}</p>
        )}
      </GlassPanel>

      <div className="grid gap-5 md:grid-cols-2">
        <IntegrationCard
          icon={CalendarDays}
          name="Google Calendar"
          provider="Composio"
          accent="#5be7f5"
          state={accountState(system, "googlecalendar")}
          description="The shared calendar service behind every clone: availability, free slots and — after your approval — new events."
          scopes={["list events", "find free time", "create event · approval required"]}
          usedBy={["Master", "Communication", "Work", "Life", "Fitness"]}
          enabled={!disabled.includes("googlecalendar")}
          onToggle={() => toggle("googlecalendar")}
          action={composioAction("googlecalendar")}
        />
        <IntegrationCard
          icon={Mail}
          name="Gmail"
          provider="Composio"
          accent="#5aa8ff"
          state={accountState(system, "gmail")}
          description="Reads recent mail for triage and saves reply drafts to your Drafts folder. CLON has no ability to send email."
          scopes={["read messages", "create draft"]}
          usedBy={["Communication", "Work"]}
          enabled={!disabled.includes("gmail")}
          onToggle={() => toggle("gmail")}
          action={composioAction("gmail")}
        />
        <IntegrationCard
          icon={Globe}
          name="Parallel"
          provider="Parallel Web Systems"
          accent="#3fd8c4"
          state={!system ? "checking" : system.parallel.configured ? "configured" : "not_configured"}
          description="Current web research for events and places. Every result carries its source link; dates are only marked verified when the source states them."
          scopes={["web research"]}
          usedBy={["Life", "Master"]}
          enabled={!disabled.includes("parallel")}
          onToggle={() => toggle("parallel")}
          footnote={system?.parallel.configured ? undefined : "Set PARALLEL_API_KEY on the server."}
        />
        <IntegrationCard
          icon={Brain}
          name="Language model"
          provider={system?.llm.configured ? system.llm.model ?? "OpenAI-compatible" : "OpenAI-compatible endpoint"}
          accent="#9879ff"
          state={!system ? "checking" : system.llm.configured ? "configured" : "not_configured"}
          description="Optional. Any OpenAI-compatible endpoint works, including open-source models served by Ollama, vLLM, Together or Groq. Without one, CLON uses its deterministic rules planner."
          scopes={["intent routing", "drafting", "summaries"]}
          footnote={system?.llm.configured ? undefined : "Set OPENAI_MODEL (or LLM_MODEL), its API key and optional base URL — see .env.example."}
        />
      </div>

      <GlassPanel className="mt-6">
        <SectionHeader eyebrow="Roadmap" title="Planned integrations" />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: MessageSquare, name: "Slack" },
            { icon: Mail, name: "Outlook" },
            { icon: BookOpen, name: "Notion" },
            { icon: FileText, name: "Google Drive" },
            { icon: Workflow, name: "Linear / Trello" },
            { icon: HeartPulse, name: "Strava · Garmin" },
            { icon: HeartPulse, name: "Health Connect" },
            { icon: HeartPulse, name: "Apple Health" },
          ].map(({ icon: Icon, name }) => (
            <div key={name} className="flex items-center gap-2.5 rounded-xl border border-dashed border-line px-3 py-2.5 text-[13px] text-mute">
              <Icon className="h-4 w-4 text-faint" /> {name}
              <span className="ml-auto font-mono text-[9px] uppercase tracking-widest text-faint">planned</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-faint">Planned integrations are not connected and are never shown as working.</p>
      </GlassPanel>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <GlassPanel>
          <SectionHeader eyebrow="Security" title="How credentials are handled" />
          <ul className="space-y-2 text-xs text-mute">
            {[
              "API keys and OAuth tokens live only on the server — never in the browser.",
              "CLON requests the minimum: read events, create events, read mail, create drafts.",
              "Live actions execute from server-signed proposals, at most once.",
              "Turning an app off here stops every clone from using it immediately.",
              "To fully revoke access, disconnect the account in your Composio dashboard.",
            ].map((t) => (
              <li key={t} className="flex gap-2">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ok" /> {t}
              </li>
            ))}
          </ul>
        </GlassPanel>
        <GlassPanel>
          <SectionHeader eyebrow="Built with" title="Development workflow" />
          <div className="flex gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-white/[0.03]">
              <Code className="h-4 w-4 text-cyan" />
            </span>
            <p className="text-xs leading-relaxed text-mute">
              CLON is open source and built with AI coding agents such as Cline. Those agents are part of how CLON is developed. They are not a runtime
              integration, and CLON doesn&apos;t claim they run inside the app.
            </p>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
