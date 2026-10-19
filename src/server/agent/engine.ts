import "server-only";

import { z } from "zod";
import { eventsInRange, freeWindows, redactFor, suggestTimeSlots } from "@/lib/availability";
import { SAMPLE_DISCOVERIES } from "@/lib/demo/seed";
import { atLocal, fmtDay, fmtRange, localHour } from "@/lib/time";
import type {
  Artifact,
  CalendarEvent,
  CloneId,
  EmailMessage,
  EventOption,
  PlanBlock,
  ProposedEvent,
  RunEvent,
  Service,
  TimeSlot,
  WorkflowStep,
  WorkTask,
  Workout,
} from "@/lib/types";
import { uid } from "@/lib/utils";
import { approval } from "../actions";
import { AppError, asAppError } from "../errors";
import { createGmailDraft, readInbox } from "../integrations/mail";
import { readCalendar } from "../integrations/calendar";
import { discoverLiveEvents } from "../integrations/parallel";
import type { RunRequest } from "../schemas";
import { createResumeToken, readResumeToken } from "../tokens";
import { planCommand } from "./planner";

type Emit = (event: RunEvent) => void;

const eventOptionSchema = z.object({
  title: z.string(),
  url: z.string().url().optional(),
  when: z.string().optional(),
  startISO: z.string().datetime({ offset: true }).optional(),
  venue: z.string().optional(),
  summary: z.string(),
  evidence: z.string().optional(),
  dateVerified: z.boolean(),
  fitsSchedule: z.boolean().optional(),
});

const replyContextSchema = z.object({
  from: z.string(),
  subject: z.string(),
  body: z.string(),
  emailId: z.string(),
});

const resumeStateSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("draft_email"),
    clone: z.enum(["master", "communication", "work", "life", "fitness"]),
    mode: z.enum(["demo", "live"]),
    subject: z.string(),
    body: z.string(),
    threadId: z.string().optional(),
    inReplyTo: replyContextSchema.optional(),
  }),
  z.object({
    kind: z.literal("event_invite"),
    clone: z.enum(["master", "communication", "work", "life", "fitness"]),
    mode: z.enum(["demo", "live"]),
    items: z.array(eventOptionSchema).min(1).max(12),
    selectedIndex: z.number().int().min(0).max(11),
    recipientEmail: z.string().email().optional(),
  }),
]);

type ResumeState = z.infer<typeof resumeStateSchema>;

function audit(
  emit: Emit,
  clone: CloneId,
  action: string,
  service: Service,
  mode: RunRequest["mode"],
  outcome: "success" | "simulated" | "blocked" | "pending" = mode === "demo" ? "simulated" : "success",
  detail?: string,
) {
  emit({ type: "audit", entry: { clone, action, service, mode, outcome, ...(detail ? { detail } : {}) } });
}

async function step<T>(
  emit: Emit,
  input: { clone: CloneId; label: string; service?: Service },
  operation: () => Promise<T> | T,
): Promise<T> {
  const workflow: WorkflowStep = {
    id: uid("step"),
    clone: input.clone,
    label: input.label,
    ...(input.service ? { service: input.service } : {}),
    status: "running",
    startedAt: new Date().toISOString(),
  };
  emit({ type: "step", step: workflow });
  try {
    const result = await operation();
    emit({ type: "step", step: { ...workflow, status: "done", endedAt: new Date().toISOString() } });
    return result;
  } catch (error) {
    const appError = asAppError(error);
    emit({
      type: "step",
      step: { ...workflow, status: "error", detail: appError.message, endedAt: new Date().toISOString() },
    });
    throw error;
  }
}

function commandDay(input: RunRequest, fallback: number) {
  const text = input.command.toLowerCase();
  if (/tomorrow|amanh[ãa]/i.test(text)) return 1;
  if (/today|hoje/i.test(text)) return 0;
  return fallback;
}

function commandWindow(input: RunRequest, fallbackDays = 1) {
  const { clock } = input.context;
  const day = commandDay(input, 0);
  const text = input.command.toLowerCase();
  if (/tonight|esta noite|hoje.*noite/i.test(text)) {
    return { from: atLocal(clock, 0, Math.max(17, localHour(clock.now, clock.tzOffset))), to: atLocal(clock, 1, 0) };
  }
  if (/week|semana/i.test(text)) return { from: atLocal(clock, 0, 0), to: atLocal(clock, 7, 23, 59) };
  return { from: atLocal(clock, day, 0), to: atLocal(clock, day + fallbackDays, 0) };
}

function emailInCommand(command: string) {
  return command.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
}

function durationInCommand(command: string, fallback = 45) {
  const minutes = command.match(/(\d{1,3})\s*(?:min|minutes?|minutos?)/i)?.[1];
  const hours = command.match(/(\d(?:\.\d+)?)\s*(?:h|hours?|horas?)/i)?.[1];
  const value = minutes ? Number(minutes) : hours ? Math.round(Number(hours) * 60) : fallback;
  return Math.min(180, Math.max(15, Number.isFinite(value) ? value : fallback));
}

function disabled(input: RunRequest, integration: string) {
  return input.context.disabledIntegrations.some((item) => item.toLowerCase().includes(integration.toLowerCase()));
}

function requireClone(input: RunRequest, clone: Exclude<CloneId, "master">) {
  if (!input.context.permissions[clone].enabled) {
    throw new AppError("CLONE_DISABLED", 403, `The ${clone} clone is disabled in Settings.`);
  }
}

async function calendarFor(
  input: RunRequest,
  viewer: CloneId,
  from: number,
  to: number,
  signal?: AbortSignal,
) {
  const shareWork = !!input.context.permissions.work.shareContext;
  const permissionOwner = viewer === "master" ? "work" : viewer;
  if (input.context.permissions[permissionOwner].calendar === "none") {
    throw new AppError("CALENDAR_PERMISSION_DENIED", 403, `Calendar access is disabled for the ${permissionOwner} clone.`);
  }
  if (input.mode === "demo") {
    const events = eventsInRange(input.context.data.calendar as CalendarEvent[], from, to);
    return { ...redactFor(events, viewer, { shareWork, categorized: true }), source: "demo" as const };
  }
  if (disabled(input, "calendar")) throw new AppError("INTEGRATION_DISABLED", 424, "Google Calendar is disabled in Settings.");
  return readCalendar({
    from: new Date(from).toISOString(),
    to: new Date(to).toISOString(),
    viewer,
    shareWork,
    timeZone: input.context.clock.timeZone,
    signal,
  });
}

async function inboxFor(input: RunRequest, signal?: AbortSignal) {
  if (input.mode === "demo") return { emails: input.context.data.emails as EmailMessage[], source: "demo" as const };
  if (disabled(input, "gmail")) throw new AppError("INTEGRATION_DISABLED", 424, "Gmail is disabled in Settings.");
  return readInbox({ signal });
}

function proposedEventTitle(event: ProposedEvent) {
  return `${event.title} · ${fmtDay(event.start, { tzOffset: 0 })}`;
}

async function emitDraft(
  input: RunRequest,
  emit: Emit,
  draft: { to: string; subject: string; body: string; threadId?: string; inReplyTo?: z.infer<typeof replyContextSchema> },
  signal?: AbortSignal,
) {
  requireClone(input, "communication");
  const permission = input.context.permissions.communication;
  const base: Omit<Extract<Artifact, { kind: "email_draft" }>, "status" | "id"> = {
    kind: "email_draft",
    to: draft.to,
    subject: draft.subject,
    body: draft.body,
    mode: input.mode,
    ...(draft.inReplyTo ? { inReplyTo: draft.inReplyTo } : {}),
  };

  if (permission.autonomy === "read_only") {
    emit({ type: "artifact", artifact: { ...base, id: uid("art"), status: "blocked", error: "Draft creation is disabled by your autonomy setting." } });
    audit(emit, "communication", `Blocked draft to ${draft.to} by permission`, "gmail", input.mode, "blocked");
    return;
  }

  if (permission.autonomy === "approval") {
    const request = approval({
      clone: "communication",
      mode: input.mode,
      title: `Save draft to ${draft.to}`,
      summary: "This creates a private Gmail draft. It never sends the message.",
      risk: "draft",
      payload: { kind: "gmail.createDraft", to: draft.to, subject: draft.subject, body: draft.body, ...(draft.threadId ? { threadId: draft.threadId } : {}) },
    });
    emit({ type: "artifact", artifact: { ...base, id: uid("art"), status: "pending_approval", approvalId: request.id } });
    emit({ type: "approval", approval: request });
    audit(emit, "communication", `Prepared a draft to ${draft.to}; approval required`, "gmail", input.mode, "pending");
    return;
  }

  if (input.mode === "demo") {
    emit({ type: "artifact", artifact: { ...base, id: uid("art"), status: "simulated" } });
    audit(emit, "communication", `Simulated a draft to ${draft.to}`, "gmail", input.mode);
    return;
  }

  const result = await step(emit, { clone: "communication", label: "Saving a private Gmail draft", service: "gmail" }, () =>
    createGmailDraft({ to: draft.to, subject: draft.subject, body: draft.body, ...(draft.threadId ? { threadId: draft.threadId } : {}) }, { signal }),
  );
  emit({
    type: "artifact",
    artifact: {
      ...base,
      id: uid("art"),
      status: "created",
      ...(result.draftId ? { draftId: result.draftId } : {}),
      ...(result.link ? { link: result.link } : {}),
    },
  });
  audit(emit, "communication", `Created a Gmail draft to ${draft.to}; nothing sent`, "gmail", input.mode, "success");
}

function inboxArtifact(emails: EmailMessage[], source: "demo" | "gmail"): Extract<Artifact, { kind: "inbox" }> {
  const unread = emails.filter((email) => email.unread);
  const needsReply = emails.filter((email) => email.needsReply);
  return {
    kind: "inbox",
    id: uid("art"),
    source,
    unread: unread.length,
    needsReply: needsReply.length,
    summary:
      needsReply.length > 0
        ? `${needsReply.length} message${needsReply.length === 1 ? "" : "s"} likely need a reply. ${emails.filter((email) => email.flagged).length ? "Suspicious instructions were isolated." : ""}`.trim()
        : "Nothing in this inbox currently looks reply-critical.",
    items: emails.slice(0, 12).map((email) => ({
      id: email.id,
      from: email.from.name || email.from.email,
      subject: email.subject,
      snippet: email.snippet,
      priority: email.priority,
      category: email.category,
      needsReply: email.needsReply,
      ...(email.meetingRequest ? { meetingRequest: true } : {}),
      ...(email.flagged ? { flagged: email.flagged } : {}),
    })),
  };
}

function rankTasks(tasks: WorkTask[], now: number) {
  const priority = { p0: 0, p1: 1, p2: 2 };
  return tasks
    .filter((task) => task.status !== "done")
    .sort((a, b) => {
      const p = priority[a.priority] - priority[b.priority];
      if (p) return p;
      const ad = a.due ? Date.parse(a.due) : Number.MAX_SAFE_INTEGER;
      const bd = b.due ? Date.parse(b.due) : Number.MAX_SAFE_INTEGER;
      return ad - bd;
    })
    .map((task) => ({
      title: task.title,
      project: task.project,
      priority: task.priority,
      ...(task.due ? { due: task.due } : {}),
      reason:
        task.status === "doing"
          ? "already in progress"
          : task.due && Date.parse(task.due) < now + 36 * 60 * 60_000
            ? "due soon"
            : `${task.estimateMin ?? 30} min estimated`,
    }));
}

function workoutSlots(input: RunRequest, events: CalendarEvent[], dayStart: number, days: number, durationMin: number) {
  const preferred = { morning: 7, midday: 12, evening: 18 }[input.context.profile.preferredWorkoutTime];
  const output: TimeSlot[] = [];
  for (let offset = 0; offset < days; offset += 1) {
    const from = atLocal({ ...input.context.clock, now: dayStart }, offset, 6);
    const to = atLocal({ ...input.context.clock, now: dayStart }, offset, 21);
    output.push(
      ...suggestTimeSlots({
        events,
        from,
        to,
        durationMin,
        bufferMin: 15,
        preferHour: preferred,
        localHourOf: (ms) => localHour(ms, input.context.clock.tzOffset),
        notBefore: input.context.clock.now + 15 * 60_000,
        limit: 3,
      }),
    );
  }
  return output.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 5);
}

function sampleEvents(input: RunRequest): EventOption[] {
  const interests = input.context.profile.interests.map((item) => item.toLowerCase());
  return SAMPLE_DISCOVERIES.map((item) => ({
    title: item.title,
    when: item.when,
    venue: `${item.area} · ${item.priceHint}`,
    summary: item.blurb,
    dateVerified: false,
  }))
    .sort((a, b) => {
      const score = (item: EventOption) => interests.filter((interest) => `${item.title} ${item.summary}`.toLowerCase().includes(interest)).length;
      return score(b) - score(a);
    })
    .slice(0, 6);
}

async function eventOptions(input: RunRequest, emit: Emit, signal?: AbortSignal) {
  requireClone(input, "life");
  const range = commandWindow(input, 3);
  const canReadCalendar = input.context.permissions.life.calendar !== "none";
  if (input.mode === "demo") {
    const calendar = canReadCalendar ? await calendarFor(input, "life", range.from, range.to, signal) : undefined;
    return { items: sampleEvents(input), source: "sample" as const, range, calendar };
  }
  if (disabled(input, "parallel")) throw new AppError("INTEGRATION_DISABLED", 424, "Parallel is disabled in Settings.");
  const result = await step(emit, { clone: "life", label: "Researching current events with sources", service: "parallel" }, () =>
    discoverLiveEvents({
      city: input.context.profile.city,
      interests: input.context.profile.interests,
      from: new Date(range.from).toISOString(),
      to: new Date(range.to).toISOString(),
      budget: input.context.profile.budget,
    }),
  );
  const calendar = canReadCalendar
    ? await step(emit, { clone: "life", label: "Checking each result against your calendar", service: "calendar" }, () =>
        calendarFor(input, "life", range.from, range.to, signal),
      )
    : undefined;
  const items = result.items.map((item) => {
    if (!item.startISO || !calendar) return item;
    const start = Date.parse(item.startISO);
    const end = start + 2 * 60 * 60_000;
    return { ...item, fitsSchedule: eventsInRange(calendar.events, start, end).length === 0 };
  });
  return { items, source: "parallel" as const, range };
}

function eventInviteBody(input: RunRequest, event: EventOption) {
  const style = input.context.profile.commStyle;
  const where = event.venue ? ` at ${event.venue}` : "";
  const when = event.when ? ` on ${event.when}` : "";
  if (style === "formal") {
    return `Hello,\n\nWould you be interested in joining me for “${event.title}”${when}${where}? ${event.summary}\n\nPlease let me know if that works for you.\n\nBest,\n${input.context.profile.name}`;
  }
  if (style === "concise") {
    return `Hi — want to join me for “${event.title}”${when}${where}?\n\n${event.url ?? ""}\n\n${input.context.profile.name}`.trim();
  }
  return `Hi!\n\nI found “${event.title}”${when}${where}, and it looks like something we'd enjoy. ${event.summary}\n\nWant to go together?${event.url ? `\n\nDetails: ${event.url}` : ""}\n\n${input.context.profile.name}`;
}

async function continueEventInvite(input: RunRequest, emit: Emit, state: Extract<ResumeState, { kind: "event_invite" }>, signal?: AbortSignal) {
  const requestedIndex = input.resume?.input.eventIndex;
  const parsedIndex = requestedIndex === undefined ? state.selectedIndex : Number.parseInt(requestedIndex, 10);
  const selectedIndex = Number.isInteger(parsedIndex) && state.items[parsedIndex] ? parsedIndex : state.selectedIndex;
  const recipient = input.resume?.input.recipientEmail?.trim() || state.recipientEmail || emailInCommand(input.command);
  const nextState = { ...state, selectedIndex, ...(recipient ? { recipientEmail: recipient } : {}) };
  const token = createResumeToken(nextState);
  emit({
    type: "artifact",
    artifact: { kind: "events", id: uid("art"), title: "Selected experience", items: state.items, source: state.mode === "live" ? "parallel" : "sample", selectedIndex, resumeToken: token },
  });
  if (!recipient || !z.string().email().safeParse(recipient).success) {
    emit({
      type: "artifact",
      artifact: {
        kind: "input",
        id: uid("art"),
        field: "recipientEmail",
        label: "Who should receive the invitation?",
        placeholder: "friend@example.com",
        token,
        hint: "CLON will create a draft only. It will never send the email.",
      },
    });
    emit({ type: "message", text: "I found an option. Add the recipient so I can prepare the invitation draft." });
    emit({ type: "done", status: "needs_input" });
    return;
  }
  const event = state.items[selectedIndex];
  await emitDraft(input, emit, { to: recipient, subject: `Want to go to ${event.title}?`, body: eventInviteBody(input, event) }, signal);
  emit({ type: "message", text: "The invitation is ready as a draft. Nothing was sent." });
  emit({ type: "done", status: "done" });
}

async function handleResume(input: RunRequest, emit: Emit, signal?: AbortSignal) {
  if (!input.resume) return false;
  const state = readResumeToken(input.resume.token, resumeStateSchema);
  if (state.mode !== input.mode) throw new AppError("RESUME_MODE_MISMATCH", 409, "Switch back to the original mode and try again.");
  emit({
    type: "run",
    runId: uid("run"),
    mode: input.mode,
    planner: "rules",
    intent: state.kind,
    title: state.kind === "event_invite" ? "Finishing your invitation" : "Finishing your email draft",
    clones: ["master", "communication", ...(state.kind === "event_invite" ? (["life"] as CloneId[]) : [])],
  });
  if (state.kind === "event_invite") {
    await continueEventInvite(input, emit, state, signal);
    return true;
  }
  const recipient = input.resume.input.recipientEmail?.trim();
  if (!recipient || !z.string().email().safeParse(recipient).success) {
    throw new AppError("INVALID_EMAIL", 400, "Enter a valid recipient email address.");
  }
  await emitDraft(
    input,
    emit,
    { to: recipient, subject: state.subject, body: state.body, ...(state.threadId ? { threadId: state.threadId } : {}), ...(state.inReplyTo ? { inReplyTo: state.inReplyTo } : {}) },
    signal,
  );
  emit({ type: "message", text: "The draft is ready. Nothing was sent." });
  emit({ type: "done", status: "done" });
  return true;
}

export async function runAgent(input: RunRequest, emit: Emit, signal?: AbortSignal) {
  try {
    if (await handleResume(input, emit, signal)) return;

    const plan = await planCommand(input.command, input.clone, signal);
    emit({ type: "run", runId: uid("run"), mode: input.mode, ...plan });

    switch (plan.intent) {
      case "calendar_view": {
        requireClone(input, "work");
        const window = commandWindow(input, 1);
        const calendar = await step(emit, { clone: "work", label: "Reading your schedule", service: "calendar" }, () =>
          calendarFor(input, input.clone, window.from, window.to, signal),
        );
        const free = freeWindows(calendar.events, window.from, window.to, 30).filter((slot) => Date.parse(slot.end) > input.context.clock.now);
        emit({
          type: "artifact",
          artifact: { kind: "calendar", id: uid("art"), title: "Calendar", events: calendar.events, free: free.slice(0, 6), source: calendar.source, redactedCount: calendar.redacted },
        });
        audit(emit, "work", `Read ${calendar.events.length} calendar events`, "calendar", input.mode);
        emit({ type: "message", text: calendar.events.length ? "Here is the schedule and the useful open space around it." : "Your calendar is clear in this window." });
        break;
      }

      case "inbox_summary": {
        requireClone(input, "communication");
        const inbox = await step(emit, { clone: "communication", label: "Reading and classifying the inbox", service: "gmail" }, () => inboxFor(input, signal));
        emit({ type: "artifact", artifact: inboxArtifact(inbox.emails, inbox.source) });
        const flagged = inbox.emails.filter((email) => email.flagged);
        if (flagged.length) {
          emit({ type: "artifact", artifact: { kind: "security", id: uid("art"), message: "Untrusted instructions isolated", detail: `${flagged.length} email${flagged.length === 1 ? "" : "s"} contained text aimed at manipulating an AI assistant. No instruction from email content was followed.` } });
          audit(emit, "communication", `Blocked ${flagged.length} prompt-injection attempt${flagged.length === 1 ? "" : "s"}`, "gmail", input.mode, "blocked");
        }
        audit(emit, "communication", `Triaged ${inbox.emails.length} inbox messages`, "gmail", input.mode);
        emit({ type: "message", text: "I separated reply-worthy messages from automated updates and isolated suspicious instructions." });
        break;
      }

      case "email_reply": {
        requireClone(input, "communication");
        const inbox = await step(emit, { clone: "communication", label: "Finding the message to answer", service: "gmail" }, () => inboxFor(input, signal));
        const command = input.command.toLowerCase();
        const target =
          inbox.emails.find((email) => `${email.from.name} ${email.from.email} ${email.subject}`.toLowerCase().split(/\s+/).some((part) => part.length > 3 && command.includes(part))) ??
          inbox.emails.find((email) => email.needsReply && email.priority === "high") ??
          inbox.emails.find((email) => email.needsReply);
        if (!target) throw new AppError("EMAIL_NOT_FOUND", 404, "I could not find a reply-worthy message in the inbox.");
        if (target.flagged) {
          emit({ type: "artifact", artifact: { kind: "security", id: uid("art"), message: "Reply blocked for safety", detail: target.flagged } });
          audit(emit, "communication", `Blocked reply to suspicious message “${target.subject}”`, "gmail", input.mode, "blocked");
          emit({ type: "message", text: "I did not draft a reply because the message contains instructions aimed at an AI assistant." });
          break;
        }
        let availability = "";
        if (target.meetingRequest && input.context.permissions.communication.calendar !== "none") {
          const from = atLocal(input.context.clock, 1, input.context.profile.workdayStart);
          const to = atLocal(input.context.clock, 6, input.context.profile.workdayEnd);
          const calendar = await step(emit, { clone: "communication", label: "Checking availability before drafting", service: "calendar" }, () =>
            calendarFor(input, "communication", from, to, signal),
          );
          const slots = suggestTimeSlots({
            events: calendar.events,
            from,
            to,
            durationMin: 30,
            localHourOf: (ms) => localHour(ms, input.context.clock.tzOffset),
            preferHour: 14,
            limit: 2,
          });
          availability = slots.length
            ? `\n\nI’m available ${slots.map((slot) => `${fmtDay(slot.start, input.context.clock)} ${fmtRange(slot.start, slot.end, input.context.clock)}`).join(" or ")}. Would either work?`
            : "\n\nMy schedule is tight in the next few days. Could you share two or three times that work for you?";
        }
        const greeting = target.from.name && target.from.name !== target.from.email ? target.from.name.split(" ")[0] : "there";
        const body = `Hi ${greeting},\n\nThanks for reaching out.${availability}\n\nBest,\n${input.context.profile.name}`;
        await emitDraft(
          input,
          emit,
          {
            to: target.from.email,
            subject: /^re:/i.test(target.subject) ? target.subject : `Re: ${target.subject}`,
            body,
            ...(target.threadId ? { threadId: target.threadId } : {}),
            inReplyTo: { from: `${target.from.name} <${target.from.email}>`, subject: target.subject, body: target.body, emailId: target.id },
          },
          signal,
        );
        emit({ type: "message", text: "I prepared a reply grounded in the message and your actual availability. Nothing was sent." });
        break;
      }

      case "draft_email": {
        requireClone(input, "communication");
        const recipient = emailInCommand(input.command);
        const subject = "Quick note";
        const body = `Hi,\n\n${input.command.replace(recipient ?? "", "").trim()}\n\nBest,\n${input.context.profile.name}`;
        if (!recipient) {
          const token = createResumeToken({ kind: "draft_email", clone: input.clone, mode: input.mode, subject, body });
          emit({ type: "artifact", artifact: { kind: "input", id: uid("art"), field: "recipientEmail", label: "Who should receive this draft?", placeholder: "name@example.com", token, hint: "The message will be saved as a draft only." } });
          emit({ type: "message", text: "Add the recipient and I’ll finish the draft." });
          emit({ type: "done", status: "needs_input" });
          return;
        }
        await emitDraft(input, emit, { to: recipient, subject, body }, signal);
        emit({ type: "message", text: "The draft is ready. Nothing was sent." });
        break;
      }

      case "priorities": {
        requireClone(input, "work");
        const items = await step(emit, { clone: "work", label: "Ranking open work by urgency and impact", service: "local" }, () =>
          rankTasks(input.context.data.tasks as WorkTask[], input.context.clock.now).slice(0, 6),
        );
        emit({ type: "artifact", artifact: { kind: "priorities", id: uid("art"), items } });
        audit(emit, "work", `Ranked ${items.length} open priorities`, "local", input.mode);
        emit({ type: "message", text: items.length ? "This order favors urgent P0 work, then near-term commitments." : "There are no open tasks to prioritize." });
        break;
      }

      case "meeting_brief": {
        requireClone(input, "work");
        const from = input.context.clock.now;
        const to = atLocal(input.context.clock, 7, 23, 59);
        const calendar = await step(emit, { clone: "work", label: "Finding your next meeting", service: "calendar" }, () =>
          calendarFor(input, "work", from, to, signal),
        );
        const meeting = calendar.events.find((event) => Date.parse(event.start) > from);
        if (!meeting) throw new AppError("MEETING_NOT_FOUND", 404, "There is no upcoming meeting in the next seven days.");
        const words = meeting.title.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3);
        const relatedTasks = (input.context.data.tasks as WorkTask[]).filter((task) => words.some((word) => `${task.title} ${task.project}`.toLowerCase().includes(word))).slice(0, 3);
        const inbox = input.mode === "demo" ? { emails: input.context.data.emails as EmailMessage[] } : await inboxFor(input, signal);
        const relatedEmails = inbox.emails.filter((email) => words.some((word) => `${email.subject} ${email.body}`.toLowerCase().includes(word))).slice(0, 3);
        const points = [
          meeting.description ? `Context: ${meeting.description}` : "Confirm the desired outcome before the meeting starts.",
          relatedTasks[0] ? `Open task: ${relatedTasks[0].title}.` : "No directly related open task was found.",
          relatedEmails[0] ? `Recent thread: ${relatedEmails[0].subject} from ${relatedEmails[0].from.name}.` : "No directly related recent email was found.",
        ];
        emit({
          type: "artifact",
          artifact: { kind: "brief", id: uid("art"), meeting: meeting.title, when: `${fmtDay(meeting.start, input.context.clock)} · ${fmtRange(meeting.start, meeting.end, input.context.clock)}`, points, related: [...relatedTasks.map((task) => `${task.project}: ${task.title}`), ...relatedEmails.map((email) => `${email.from.name}: ${email.subject}`)] },
        });
        audit(emit, "work", `Prepared a brief for “${meeting.title}”`, "local", input.mode);
        emit({ type: "message", text: "Here is the shortest useful brief from your calendar, tasks and inbox." });
        break;
      }

      case "workout_slot": {
        requireClone(input, "fitness");
        const duration = durationInCommand(input.command);
        const day = commandDay(input, 1);
        const from = atLocal(input.context.clock, day, 0);
        const to = atLocal(input.context.clock, day + 3, 0);
        const calendar = await step(emit, { clone: "fitness", label: "Finding conflict-free training windows", service: "calendar" }, () =>
          calendarFor(input, "fitness", from, to, signal),
        );
        const slots = workoutSlots(input, calendar.events, from, 3, duration);
        emit({ type: "artifact", artifact: { kind: "slots", id: uid("art"), title: "Best workout windows", slots, durationMin: duration } });
        emit({
          type: "artifact",
          artifact: {
            kind: "workout",
            id: uid("art"),
            title: `${duration}-minute full-body session`,
            type: "strength",
            durationMin: duration,
            intensity: input.context.profile.fitnessLevel === "beginner" ? "easy" : "moderate",
            blocks: [
              { name: "Warm-up", detail: `${Math.max(5, Math.round(duration * 0.15))} min · easy mobility` },
              { name: "Main work", detail: `${Math.max(10, Math.round(duration * 0.65))} min · squat, push, pull, hinge` },
              { name: "Cool-down", detail: `${Math.max(5, Math.round(duration * 0.2))} min · easy movement` },
            ],
            rationale: "A simple full-body session that fits the requested window and leaves a buffer around calendar commitments.",
            safety: "Use comfortable loads, keep controlled form, and stop for pain, dizziness or unusual shortness of breath. This is general guidance, not medical advice.",
          },
        });
        if (slots.length && input.context.permissions.fitness.calendar === "propose") {
          const options = slots.slice(0, 3).map<ProposedEvent>((slot) => ({ title: `${duration}-minute workout`, start: slot.start, end: slot.end, category: "fitness", description: "Proposed by CLON Fitness Clone" }));
          const request = approval({ clone: "fitness", mode: input.mode, title: `Add a ${duration}-minute workout`, summary: "Choose one conflict-free option. CLON will add only the selected event.", risk: "write", payload: { kind: "calendar.createEvents", events: [options[0]], options } });
          emit({ type: "approval", approval: request });
          audit(emit, "fitness", `Proposed ${options.length} workout slots`, "calendar", input.mode, "pending");
        }
        emit({ type: "message", text: slots.length ? "The first option best matches your preferred training time and preserves buffers around meetings." : "I couldn't find a safe window of that length in the next three days." });
        break;
      }

      case "workout_plan": {
        requireClone(input, "fitness");
        const goal = input.context.profile.weeklySessionGoal;
        const level = input.context.profile.fitnessLevel;
        const templates = [
          ["Monday", "Full-body strength", level === "beginner" ? "35 min · controlled compound movements" : "50 min · squat, press, pull and hinge"],
          ["Wednesday", "Easy aerobic work", "30–40 min · conversational pace"],
          ["Friday", "Strength + mobility", level === "advanced" ? "55 min · moderate-heavy strength plus mobility" : "40 min · technique-first strength plus mobility"],
          ["Sunday", "Recovery", "30 min · walk, easy cycle or yoga"],
          ["Tuesday", "Optional conditioning", "20–25 min · stop well before form breaks"],
          ["Saturday", "Outdoor session", "45–60 min · easy sustainable effort"],
        ];
        const days = templates.slice(0, Math.min(goal, templates.length)).map(([day, focus, detail]) => ({ day, focus, detail }));
        emit({ type: "artifact", artifact: { kind: "training_plan", id: uid("art"), title: `${goal}-session weekly plan`, days, safety: "Adjust or stop for pain, dizziness or unusual shortness of breath. This is general fitness guidance, not medical advice." } });
        audit(emit, "fitness", `Created a ${days.length}-session training plan`, "local", input.mode);
        emit({ type: "message", text: "This balances strength, aerobic work and recovery at your stated level." });
        break;
      }

      case "fitness_stats": {
        requireClone(input, "fitness");
        const workouts = input.context.data.workouts as Workout[];
        const days = Array.from({ length: 7 }, (_, index) => {
          const dayStart = atLocal(input.context.clock, index - 6, 0);
          const dayEnd = atLocal(input.context.clock, index - 5, 0);
          const sessions = workouts.filter((workout) => Date.parse(workout.date) >= dayStart && Date.parse(workout.date) < dayEnd);
          return { date: new Date(dayStart).toISOString(), minutes: sessions.reduce((sum, workout) => sum + workout.durationMin, 0), sessions: sessions.length };
        });
        const recent = days.filter((day) => day.sessions > 0);
        let streak = 0;
        for (let index = days.length - 1; index >= 0; index -= 1) {
          if (days[index].sessions > 0) streak += 1;
          else if (index !== days.length - 1) break;
        }
        const sources = new Set(workouts.filter((workout) => Date.parse(workout.date) >= Date.parse(days[0].date)).map((workout) => workout.source));
        const source = sources.size > 1 ? "mixed" : sources.has("manual") ? "manual" : sources.has("demo") ? "demo" : "none";
        emit({ type: "artifact", artifact: { kind: "fitness_stats", id: uid("art"), days, sessions: recent.reduce((sum, day) => sum + day.sessions, 0), minutes: recent.reduce((sum, day) => sum + day.minutes, 0), activeDays: recent.length, streak, goalSessions: input.context.profile.weeklySessionGoal, source } });
        audit(emit, "fitness", "Calculated seven-day training consistency", "local", input.mode);
        emit({ type: "message", text: recent.length ? "Consistency is based only on sessions currently logged in CLON." : "No sessions are logged in the last seven days yet." });
        break;
      }

      case "discover_events": {
        const found = await eventOptions(input, emit, signal);
        emit({ type: "artifact", artifact: { kind: "events", id: uid("art"), title: `Ideas in ${input.context.profile.city}`, items: found.items, source: found.source } });
        audit(emit, "life", `Found ${found.items.length} event options`, found.source === "parallel" ? "parallel" : "local", input.mode);
        emit({ type: "message", text: found.source === "parallel" ? "These are current web results with source links; unverified dates are labeled." : "These are illustrative demo ideas, not current listings." });
        break;
      }

      case "event_invite": {
        const found = await eventOptions(input, emit, signal);
        if (!found.items.length) throw new AppError("NO_EVENTS_FOUND", 404, "No sufficiently verified events matched this request.");
        if (found.calendar) {
          const free = freeWindows(found.calendar.events, found.range.from, found.range.to, 30);
          emit({
            type: "artifact",
            artifact: {
              kind: "calendar",
              id: uid("art"),
              title: "Calendar for the requested window",
              events: found.calendar.events,
              free: free.slice(0, 6),
              source: found.calendar.source,
              redactedCount: found.calendar.redacted,
            },
          });
        }
        const preferredIndex = Math.max(0, found.items.findIndex((item) => item.fitsSchedule !== false));
        const recipient = emailInCommand(input.command);
        const state: Extract<ResumeState, { kind: "event_invite" }> = { kind: "event_invite", clone: input.clone, mode: input.mode, items: found.items, selectedIndex: preferredIndex, ...(recipient ? { recipientEmail: recipient } : {}) };
        await continueEventInvite(input, emit, state, signal);
        return;
      }

      case "organize_day":
      default: {
        requireClone(input, "work");
        const day = commandDay(input, 1);
        const from = atLocal(input.context.clock, day, 0);
        const to = atLocal(input.context.clock, day + 1, 0);
        const calendar = await step(emit, { clone: "work", label: "Building a conflict-free day plan", service: "calendar" }, () =>
          calendarFor(input, "master", from, to, signal),
        );
        const openTasks = rankTasks(input.context.data.tasks as WorkTask[], input.context.clock.now);
        emit({ type: "artifact", artifact: { kind: "priorities", id: uid("art"), items: openTasks.slice(0, 5) } });
        const events: ProposedEvent[] = [];
        const conflicts: string[] = [];
        const workStart = atLocal(input.context.clock, day, input.context.profile.workdayStart);
        const workEnd = atLocal(input.context.clock, day, input.context.profile.workdayEnd);
        const workFree = freeWindows(calendar.events, workStart, workEnd, 30, 10);
        if (input.context.permissions.work.calendar === "propose" && openTasks[0] && workFree[0]) {
          const minutes = Math.min(90, Math.max(30, (input.context.data.tasks as WorkTask[]).find((task) => task.title === openTasks[0].title)?.estimateMin ?? 60));
          const start = Date.parse(workFree[0].start);
          if (start + minutes * 60_000 <= Date.parse(workFree[0].end)) {
            events.push({ title: `Focus: ${openTasks[0].title}`, start: new Date(start).toISOString(), end: new Date(start + minutes * 60_000).toISOString(), category: "work", description: "Proposed by CLON Work Clone" });
          }
        } else if (openTasks[0] && input.context.permissions.work.calendar === "propose") conflicts.push(`No focus window fits “${openTasks[0].title}” inside your workday.`);
        else if (openTasks[0]) conflicts.push("Work calendar proposals are disabled in Settings.");
        const fitnessEnabled = input.context.permissions.fitness.enabled;
        const slots = fitnessEnabled
          ? workoutSlots(input, [...calendar.events, ...events.map((event, index) => ({ ...event, id: `proposed_${index}`, source: "clon" as const }))], from, 1, 45)
          : [];
        if (slots[0] && input.context.permissions.fitness.calendar === "propose") events.push({ title: "Workout", start: slots[0].start, end: slots[0].end, category: "fitness", description: "Proposed by CLON Fitness Clone" });
        else if (!fitnessEnabled) conflicts.push("The Fitness clone is disabled in Settings.");
        else if (input.context.permissions.fitness.calendar === "propose") conflicts.push("No 45-minute workout window fits with a 15-minute meeting buffer.");
        else conflicts.push("Fitness calendar proposals are disabled in Settings.");
        const blocks: PlanBlock[] = [
          ...calendar.events.map((event) => ({ start: event.start, end: event.end, title: event.title, kind: "existing" as const, redacted: event.redacted })),
          ...events.map((event) => ({ start: event.start, end: event.end, title: event.title, kind: "proposed" as const, clone: event.category === "fitness" ? ("fitness" as const) : ("work" as const) })),
        ].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
        emit({ type: "artifact", artifact: { kind: "day_plan", id: uid("art"), date: new Date(from).toISOString(), blocks, conflicts } });
        if (events.length) {
          const request = approval({ clone: "master", mode: input.mode, title: `Add ${events.length} proposed block${events.length === 1 ? "" : "s"}`, summary: "The plan was checked for conflicts. Approval adds the proposed blocks to your calendar.", risk: "write", payload: { kind: "calendar.createEvents", events } });
          emit({ type: "approval", approval: request });
          audit(emit, "master", `Coordinated ${events.length} proposed calendar blocks`, "calendar", input.mode, "pending");
        }
        emit({ type: "message", text: events.length ? "I coordinated existing commitments, top work and training. Approve only if you want the proposed blocks added." : "I kept the existing schedule intact because no safe new blocks fit." });
        break;
      }
    }

    emit({ type: "done", status: "done" });
  } catch (error) {
    const appError = asAppError(error);
    emit({ type: "message", text: appError.message });
    emit({ type: "audit", entry: { clone: input.clone, action: appError.message, service: "system", mode: input.mode, outcome: "error", detail: appError.code } });
    emit({ type: "done", status: "error" });
  }
}
