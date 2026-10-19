import "server-only";

import { createHash } from "node:crypto";
import type { EmailMessage } from "@/lib/types";
import { detectInjection } from "@/lib/untrusted";
import { serverConfig } from "../config";
import { AppError } from "../errors";
import {
  collectRecords,
  decodeBase64Url,
  firstBoolean,
  firstString,
  htmlToText,
  isRecord,
  nestedRecord,
  truncateText,
  validIso,
} from "./normalize";
import { executeUseCase } from "./composio";

const INJECTION = [
  /ignore (all |any |the )?(previous|prior|system|developer) instructions?/i,
  /(assistant|ai|model),? (must|should|please|now) (send|forward|reveal|upload|delete|ignore)/i,
  /do not (tell|mention|inform|show) (the )?user/i,
  /(system prompt|developer message|hidden instructions?|api key|access token)/i,
  /override (your|the) (rules|policy|instructions?)/i,
];

export function promptInjectionWarning(text: string) {
  return detectInjection(text) ?? (INJECTION.some((pattern) => pattern.test(text))
    ? "Contains instructions aimed at an AI assistant. CLON treated them as untrusted email content and did not follow them."
    : undefined);
}

function headerMap(record: Record<string, unknown>) {
  const payload = nestedRecord(record, ["payload", "message", "email"]);
  const candidates = [record.headers, payload?.headers].filter(Array.isArray).flat() as unknown[];
  const headers = new Map<string, string>();
  for (const item of candidates) {
    if (!isRecord(item)) continue;
    const name = firstString(item, ["name", "key"]);
    const value = firstString(item, ["value"]);
    if (name && value) headers.set(name.toLowerCase(), value);
  }
  return headers;
}

function parseSender(value: string | undefined) {
  if (!value) return { name: "Unknown sender", email: "unknown@example.invalid" };
  const match = value.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  const email = (match?.[2] ?? value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "unknown@example.invalid").trim();
  const name = (match?.[1] ?? (value.replace(email, "").replace(/[<>\"]+/g, "").trim() || email.split("@")[0])).trim();
  return { name, email };
}

function bodyFromPayload(record: Record<string, unknown>) {
  const direct = firstString(record, ["body", "messageText", "message_text", "text", "content", "decodedBody", "decoded_body"]);
  if (direct && direct.length > 8) return /<[^>]+>/.test(direct) ? htmlToText(direct) : direct;

  const payload = nestedRecord(record, ["payload"]);
  const records = collectRecords(payload ?? record, 250, 10);
  for (const part of records) {
    const mime = firstString(part, ["mimeType", "mime_type", "contentType", "content_type"]);
    const body = nestedRecord(part, ["body"]);
    const data = firstString(body ?? part, ["data", "bodyData", "body_data"]);
    if (data && (!mime || /text\/plain/i.test(mime))) {
      const decoded = decodeBase64Url(data);
      if (decoded.trim()) return decoded.trim();
    }
  }
  for (const part of records) {
    const body = nestedRecord(part, ["body"]);
    const data = firstString(body ?? part, ["data", "bodyData", "body_data"]);
    if (data) {
      const decoded = decodeBase64Url(data);
      if (decoded.trim()) return htmlToText(decoded);
    }
  }
  return "";
}

function labels(record: Record<string, unknown>) {
  const raw = record.labelIds ?? record.label_ids ?? record.labels;
  return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === "string").map((item) => item.toUpperCase()) : [];
}

function categoryOf(from: string, subject: string, labelList: string[]): EmailMessage["category"] {
  if (labelList.some((label) => /CATEGORY_(PROMOTIONS|UPDATES|FORUMS)/.test(label))) return "updates";
  const text = `${from} ${subject}`.toLowerCase();
  if (/github|invoice|billing|newsletter|notification|digest|no-?reply/.test(text)) return "updates";
  if (/roadmap|review|meeting|project|team|client|partner|investor|interview|deadline/.test(text)) return "work";
  return "personal";
}

function normalizeEmails(data: unknown): EmailMessage[] {
  const output: EmailMessage[] = [];
  const seen = new Set<string>();
  for (const record of collectRecords(data, 2_000, 10)) {
    const headers = headerMap(record);
    const subject = firstString(record, ["subject", "title"]) ?? headers.get("subject");
    const fromRaw = firstString(record, ["from", "sender", "senderEmail", "sender_email"]) ?? headers.get("from");
    const rawId = firstString(record, ["id", "messageId", "message_id", "emailId", "email_id"]);
    const snippet = firstString(record, ["snippet", "preview", "summary"]);
    if (!subject || (!rawId && !fromRaw) || (!snippet && !record.payload && !record.body && !record.messageText && !record.message_text)) continue;
    const body = truncateText(bodyFromPayload(record) || snippet || "", 50_000);
    const from = parseSender(fromRaw);
    const received =
      validIso(firstString(record, ["receivedAt", "received_at", "internalDate", "internal_date", "timestamp", "date"])) ??
      validIso(headers.get("date")) ??
      new Date(0).toISOString();
    const id = rawId ?? `gmail_${createHash("sha1").update(`${from.email}|${subject}|${received}`).digest("hex").slice(0, 20)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const labelList = labels(record);
    const unread = firstBoolean(record, ["unread", "isUnread", "is_unread"]) ?? labelList.includes("UNREAD");
    const text = `${subject}\n${snippet ?? ""}\n${body}`;
    const flagged = promptInjectionWarning(text);
    const automated = /no-?reply|notifications?|mailer-daemon/i.test(from.email) || categoryOf(from.email, subject, labelList) === "updates";
    const meetingRequest = /\b(meet|meeting|calendar|schedule|availability|free (?:on|at)|call|zoom)\b/i.test(text);
    const important = labelList.includes("IMPORTANT") || /urgent|action required|deadline|today|tomorrow/i.test(subject);
    output.push({
      id,
      ...(firstString(record, ["threadId", "thread_id"]) ? { threadId: firstString(record, ["threadId", "thread_id"]) } : {}),
      from,
      subject,
      snippet: truncateText(snippet || body.replace(/\s+/g, " "), 500),
      body,
      receivedAt: received,
      unread,
      priority: important ? "high" : automated ? "low" : "normal",
      category: categoryOf(from.email, subject, labelList),
      needsReply: !automated && !flagged,
      ...(meetingRequest ? { meetingRequest: true } : {}),
      ...(flagged ? { flagged } : {}),
      demo: false,
    });
  }
  return output.sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt)).slice(0, 100);
}

export async function readInbox(options: { signal?: AbortSignal } = {}) {
  const result = await executeUseCase({
    toolkit: "gmail",
    useCase: "Fetch the most recent messages in the Gmail inbox, including unread and read messages. Return id, thread id, sender, subject, snippet, body, date and labels. Do not modify, archive, delete, mark read or send anything.",
    preferredSlugParts: ["FETCH", "EMAIL", "LIST", "SEARCH", "MESSAGE"],
    forbiddenSlugParts: ["SEND", "DELETE", "TRASH", "MODIFY", "ARCHIVE", "DRAFT"],
    configuredSlug: serverConfig().composio.tools.gmailList,
    arguments: { query: "in:inbox newer_than:30d", maxResults: 50 },
    signal: options.signal,
  });
  return { emails: normalizeEmails(result.data), source: "gmail" as const, tool: result.slug, logId: result.logId };
}

export async function createGmailDraft(
  draft: { to: string; subject: string; body: string; threadId?: string },
  options: { signal?: AbortSignal } = {},
) {
  const result = await executeUseCase({
    toolkit: "gmail",
    useCase: "Create a Gmail draft only. Save it in Drafts and do not send the email under any circumstances.",
    preferredSlugParts: ["CREATE", "DRAFT"],
    forbiddenSlugParts: ["SEND", "DELETE", "TRASH"],
    configuredSlug: serverConfig().composio.tools.gmailDraft,
    arguments: {
      recipient: draft.to,
      subject: draft.subject,
      body: draft.body,
      threadId: draft.threadId,
    },
    signal: options.signal,
  });
  const records = collectRecords(result.data);
  const best = records.find((record) => firstString(record, ["draftId", "draft_id", "id", "messageId", "message_id"])) ?? records[0] ?? {};
  const draftId = firstString(best, ["draftId", "draft_id", "id", "messageId", "message_id"]);
  if (!draftId && !Object.keys(result.data).length) {
    throw new AppError("GMAIL_DRAFT_FAILED", 502, "Gmail did not confirm that the draft was created.");
  }
  const link = firstString(best, ["link", "url", "htmlLink", "html_link"]) ?? "https://mail.google.com/mail/u/0/#drafts";
  return { draftId, link: /^https:\/\//i.test(link) ? link : undefined, tool: result.slug, logId: result.logId };
}
