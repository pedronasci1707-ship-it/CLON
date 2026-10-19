import "server-only";

import type { ActionPayload, ApprovalRequest, CalendarEvent, CloneId, Mode, Risk } from "@/lib/types";
import { uid } from "@/lib/utils";
import type { ExecuteActionRequest } from "./schemas";
import { AppError } from "./errors";
import { createApprovalToken, executeOnce, verifyApprovalToken } from "./tokens";
import { createCalendarEvents } from "./integrations/calendar";
import { createGmailDraft } from "./integrations/mail";

export function approval(input: {
  clone: CloneId;
  mode: Mode;
  title: string;
  summary: string;
  risk: Risk;
  payload: ActionPayload;
}): ApprovalRequest {
  const id = uid("appr");
  return {
    id,
    createdAt: new Date().toISOString(),
    clone: input.clone,
    title: input.title,
    summary: input.summary,
    risk: input.risk,
    mode: input.mode,
    payload: input.payload,
    token: input.mode === "live" ? createApprovalToken({ id, clone: input.clone, mode: input.mode, payload: input.payload }) : null,
    status: "pending",
  };
}

function selectedPayload(payload: ActionPayload, optionIndex?: number): ActionPayload {
  if (payload.kind !== "calendar.createEvents" || optionIndex === undefined) return payload;
  if (!payload.options?.[optionIndex]) {
    throw new AppError("INVALID_OPTION", 400, "The selected calendar option is not available.");
  }
  return { kind: "calendar.createEvents", events: [payload.options[optionIndex]], options: payload.options };
}

function simulate(payload: ActionPayload, clone: CloneId) {
  if (payload.kind === "gmail.createDraft") {
    return {
      ok: true as const,
      simulated: true,
      summary: `Simulated a Gmail draft to ${payload.to}. Nothing was sent or saved externally.`,
    };
  }
  const createdEvents: CalendarEvent[] = payload.events.map((event) => ({
    ...event,
    id: uid("clon_ev"),
    source: "clon",
    createdBy: clone,
  }));
  return {
    ok: true as const,
    simulated: true,
    summary: `Simulated ${createdEvents.length === 1 ? "one calendar event" : `${createdEvents.length} calendar events`}. No external calendar was changed.`,
    createdEvents,
  };
}

export async function executeApprovedAction(input: ExecuteActionRequest, signal?: AbortSignal) {
  const approvalInput = input.approval;
  if (approvalInput.mode === "demo") {
    return simulate(selectedPayload(approvalInput.payload as ActionPayload, input.optionIndex), approvalInput.clone);
  }
  if (!approvalInput.token) throw new AppError("APPROVAL_REQUIRED", 403, "A valid server approval token is required.");

  const verified = verifyApprovalToken({
    token: approvalInput.token,
    id: approvalInput.id,
    clone: approvalInput.clone,
    mode: approvalInput.mode,
    payload: approvalInput.payload as ActionPayload,
  });
  // The encrypted server token is authoritative. The client copy above is
  // validated only to prove it refers to the same signed action.
  const payload = selectedPayload(verified.payload, input.optionIndex);

  return executeOnce(verified.nonce, verified.expiresAt, async () => {
    if (payload.kind === "gmail.createDraft") {
      const result = await createGmailDraft(payload, { signal });
      return {
        ok: true as const,
        simulated: false,
        summary: `Created a Gmail draft to ${payload.to}. It was not sent.`,
        link: result.link,
        draftId: result.draftId,
      };
    }
    const createdEvents = await createCalendarEvents(payload.events, {
      clone: approvalInput.clone,
      timeZone: input.clock.timeZone,
      approvalId: approvalInput.id,
      signal,
    });
    return {
      ok: true as const,
      simulated: false,
      summary: `Created ${createdEvents.length === 1 ? "one event" : `${createdEvents.length} events`} in Google Calendar.`,
      link: createdEvents.find((event) => event.link)?.link,
      createdEvents,
    };
  });
}
