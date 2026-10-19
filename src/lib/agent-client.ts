"use client";

import { useClon } from "./store";
import { browserClock } from "./time";
import type { ApprovalRequest, CalendarEvent, CloneId, RunEvent, Service, ThreadMessage } from "./types";
import { uid } from "./utils";

/** Server errors may be `{ error: "msg" }` or `{ error: { message } }`. */
export function errorMessage(data: unknown, fallback: string): string {
  const e = (data as { error?: unknown } | null)?.error;
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && typeof (e as { message?: unknown }).message === "string") return (e as { message: string }).message;
  return fallback;
}

/** Everything the server needs to act on the user's behalf for one request. */
export function buildContext() {
  const s = useClon.getState();
  const clock = browserClock();
  const demo = s.mode === "demo";
  return {
    clock,
    profile: s.profile,
    permissions: s.permissions,
    disabledIntegrations: s.disabledIntegrations,
    data: {
      // In Live mode, calendar and email come from connected accounts — never from demo seeds.
      calendar: demo ? s.calendar : [],
      emails: demo ? s.emails : [],
      tasks: demo ? s.tasks : s.tasks.filter((t) => !t.demo),
      workouts: demo ? s.workouts : s.workouts.filter((w) => w.source === "manual"),
    },
  };
}

interface RunOptions {
  resume?: { token: string; input: Record<string, string> };
  displayText?: string;
}

export async function runCommand(clone: CloneId, command: string, opts: RunOptions = {}) {
  const store = useClon.getState();
  if (store.running) {
    store.notify({ kind: "update", title: "One moment", body: "Your clone is still finishing the previous request." });
    return;
  }
  const text = command.trim();
  if (!text && !opts.resume) return;

  const at = new Date().toISOString();
  const assistantId = uid("msg");
  store.appendMessage(clone, { id: uid("msg"), role: "user", at, text: opts.displayText ?? text });
  store.appendMessage(clone, {
    id: assistantId,
    role: "assistant",
    at,
    text: "",
    status: "running",
    steps: [],
    artifacts: [],
    mode: store.mode,
  });
  store.setRunning({ clone, activeClones: ["master"], label: "Interpreting your request" });

  const patch = (fn: (m: ThreadMessage) => ThreadMessage) => useClon.getState().patchMessage(clone, assistantId, fn);
  let involved: CloneId[] = ["master"];
  let finalStatus: "done" | "needs_input" | "error" = "done";

  const handle = (ev: RunEvent) => {
    const s = useClon.getState();
    switch (ev.type) {
      case "run":
        involved = ev.clones;
        patch((m) => ({ ...m, planner: ev.planner, intent: ev.intent, title: ev.title, clones: ev.clones, mode: ev.mode }));
        s.setRunning({ clone, activeClones: ["master"], label: ev.title });
        break;
      case "step":
        patch((m) => {
          const steps = m.steps ?? [];
          const i = steps.findIndex((x) => x.id === ev.step.id);
          return { ...m, steps: i >= 0 ? steps.map((x, j) => (j === i ? ev.step : x)) : [...steps, ev.step] };
        });
        if (ev.step.status === "running") {
          s.setRunning({ clone, activeClones: Array.from(new Set([ev.step.clone, "master"])) as CloneId[], label: ev.step.label });
        }
        break;
      case "artifact":
        patch((m) => {
          const arts = m.artifacts ?? [];
          const i = arts.findIndex((a) => a.id === ev.artifact.id);
          return { ...m, artifacts: i >= 0 ? arts.map((a, j) => (j === i ? ev.artifact : a)) : [...arts, ev.artifact] };
        });
        if (ev.artifact.kind === "email_draft" && ev.artifact.inReplyTo) {
          s.saveDraft({
            emailId: ev.artifact.inReplyTo.emailId,
            to: ev.artifact.to,
            subject: ev.artifact.subject,
            body: ev.artifact.body,
            status: ev.artifact.status,
            mode: ev.artifact.mode,
            at: new Date().toISOString(),
            link: ev.artifact.link,
          });
        }
        break;
      case "approval":
        s.addApproval(ev.approval);
        patch((m) => ({ ...m, artifacts: [...(m.artifacts ?? []), { kind: "approval", id: uid("art"), approvalId: ev.approval.id }] }));
        s.notify({ kind: "approval", title: "Approval needed", body: ev.approval.title, href: "/approvals" });
        break;
      case "audit":
        s.recordActivity(ev.entry);
        if (ev.entry.outcome === "error") {
          s.notify({ kind: "error", title: "A connected service failed", body: ev.entry.detail ?? ev.entry.action, href: "/activity" });
        }
        break;
      case "message":
        patch((m) => ({ ...m, text: ev.text }));
        break;
      case "done":
        finalStatus = ev.status;
        patch((m) => ({ ...m, status: ev.status }));
        break;
    }
  };

  try {
    const res = await fetch("/api/agent/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ command: text, clone, mode: store.mode, context: buildContext(), resume: opts.resume }),
    });
    if (!res.ok || !res.body) {
      const err = await res.json().catch(() => null);
      throw new Error(errorMessage(err, `Request failed (${res.status})`));
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (line) handle(JSON.parse(line) as RunEvent);
      }
    }
    if (buffer.trim()) handle(JSON.parse(buffer) as RunEvent);
  } catch (e) {
    finalStatus = "error";
    const message = e instanceof Error ? e.message : String(e);
    patch((m) => ({ ...m, status: "error", text: m.text || `I couldn't complete that: ${message}` }));
    useClon.getState().notify({ kind: "error", title: "Request failed", body: message });
  } finally {
    const s = useClon.getState();
    s.setRunning(null);
    if (finalStatus === "done" && involved.length > 1) {
      s.notify({ kind: "complete", title: "Workflow completed", body: `Coordinated ${involved.length - 1} clone${involved.length > 2 ? "s" : ""}.`, href: `/clones/${clone}` });
    }
  }
}

function serviceOf(a: ApprovalRequest): Service {
  return a.payload.kind === "gmail.createDraft" ? "gmail" : "calendar";
}

/** Approve or decline a pending action. Execution always goes through the server. */
export async function decideApproval(id: string, approve: boolean, optionIndex?: number) {
  const s = useClon.getState();
  const a = s.approvals.find((x) => x.id === id);
  if (!a || a.status !== "pending") return;

  if (!approve) {
    s.updateApproval(id, { status: "rejected" });
    s.recordActivity({ clone: a.clone, action: `Declined — ${a.title}`, service: serviceOf(a), mode: a.mode, outcome: "rejected" });
    return;
  }

  s.updateApproval(id, { status: "executing", selectedOption: optionIndex });
  try {
    const res = await fetch("/api/actions/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        approval: { id: a.id, token: a.token, mode: a.mode, clone: a.clone, payload: a.payload },
        optionIndex,
        clock: browserClock(),
      }),
    });
    const data = (await res.json().catch(() => null)) as {
      ok?: boolean;
      simulated?: boolean;
      summary?: string;
      link?: string;
      createdEvents?: CalendarEvent[];
    } | null;
    if (!res.ok || !data?.ok) throw new Error(errorMessage(data, `Execution failed (${res.status})`));
    const st = useClon.getState();
    if (data.simulated && data.createdEvents?.length) st.addCalendarEvents(data.createdEvents);
    st.updateApproval(id, { status: "executed", result: data.summary, link: data.link });
    st.recordActivity({
      clone: a.clone,
      action: data.summary ?? a.title,
      service: serviceOf(a),
      mode: a.mode,
      outcome: data.simulated ? "simulated" : "success",
      detail: data.simulated ? "Demo mode — simulated, nothing external was changed." : undefined,
    });
    st.notify({
      kind: "complete",
      title: data.simulated ? "Done (simulated)" : "Done",
      body: data.summary,
      href: "/activity",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const st = useClon.getState();
    st.updateApproval(id, { status: "failed", result: message });
    st.recordActivity({ clone: a.clone, action: `Failed — ${a.title}`, service: serviceOf(a), mode: a.mode, outcome: "error", detail: message });
    st.notify({ kind: "error", title: "Action failed", body: message, href: "/approvals" });
  }
}
