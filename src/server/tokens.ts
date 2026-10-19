import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { serverConfig } from "./config";
import { AppError } from "./errors";
import { actionPayloadSchema } from "./schemas";
import type { ActionPayload, CloneId, Mode } from "@/lib/types";

const VERSION = "v1";
const runtime = globalThis as typeof globalThis & {
  __clonEphemeralSecret?: string;
  __clonExecutions?: Map<string, { expiresAt: number; promise: Promise<unknown> }>;
};
const ephemeralSecret = (runtime.__clonEphemeralSecret ??= randomBytes(32).toString("base64url"));
const executions = (runtime.__clonExecutions ??= new Map());

const envelopeSchema = z.object({
  purpose: z.enum(["resume", "approval"]),
  issuedAt: z.number().int(),
  expiresAt: z.number().int(),
  nonce: z.string().uuid(),
  data: z.unknown(),
});

const approvalDataSchema = z.object({
  id: z.string(),
  clone: z.enum(["master", "communication", "work", "life", "fitness"]),
  mode: z.literal("live"),
  payloadHash: z.string().length(64),
  payload: actionPayloadSchema,
});

function key(secret: string, purpose: string) {
  return createHash("sha256").update(`clon:${purpose}:`).update(secret).digest();
}

function encode(value: Buffer) {
  return value.toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url");
}

function seal(purpose: "resume" | "approval", data: unknown, secret: string, ttlMs: number) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret, purpose), iv);
  const now = Date.now();
  const plaintext = Buffer.from(
    JSON.stringify({ purpose, issuedAt: now, expiresAt: now + ttlMs, nonce: randomUUID(), data }),
    "utf8",
  );
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return `${VERSION}.${encode(iv)}.${encode(encrypted)}.${encode(cipher.getAuthTag())}`;
}

function unseal(purpose: "resume" | "approval", token: string, secret: string) {
  const [version, ivRaw, bodyRaw, tagRaw, extra] = token.split(".");
  if (version !== VERSION || !ivRaw || !bodyRaw || !tagRaw || extra) {
    throw new AppError("INVALID_TOKEN", 400, "The action token is invalid.");
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(secret, purpose), decode(ivRaw));
    decipher.setAuthTag(decode(tagRaw));
    const plaintext = Buffer.concat([decipher.update(decode(bodyRaw)), decipher.final()]).toString("utf8");
    const envelope = envelopeSchema.parse(JSON.parse(plaintext) as unknown);
    if (envelope.purpose !== purpose || envelope.expiresAt <= Date.now()) {
      throw new AppError("EXPIRED_TOKEN", 410, "This action has expired. Run the command again.");
    }
    return envelope;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("INVALID_TOKEN", 400, "The action token is invalid or has been altered.");
  }
}

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`)
    .join(",")}}`;
}

function payloadHash(payload: ActionPayload) {
  return createHash("sha256").update(stable(payload)).digest("hex");
}

export function createResumeToken(data: unknown, ttlMs = 20 * 60_000) {
  return seal("resume", data, serverConfig().approvalSecret ?? ephemeralSecret, ttlMs);
}

export function readResumeToken<T>(token: string, schema: z.ZodType<T>): T {
  const envelope = unseal("resume", token, serverConfig().approvalSecret ?? ephemeralSecret);
  return schema.parse(envelope.data);
}

export function createApprovalToken(input: { id: string; clone: CloneId; mode: Mode; payload: ActionPayload }) {
  const secret = serverConfig().approvalSecret;
  if (!secret || secret.length < 32) {
    throw new AppError(
      "APPROVAL_SECRET_MISSING",
      503,
      "Live actions are disabled until CLON_APPROVAL_SECRET is configured with at least 32 characters.",
    );
  }
  if (input.mode !== "live") throw new AppError("INVALID_MODE", 400, "Only live actions need approval tokens.");
  return seal(
    "approval",
    { id: input.id, clone: input.clone, mode: "live", payloadHash: payloadHash(input.payload), payload: input.payload },
    secret,
    20 * 60_000,
  );
}

export function verifyApprovalToken(input: {
  token: string;
  id: string;
  clone: CloneId;
  mode: Mode;
  payload: ActionPayload;
}) {
  const secret = serverConfig().approvalSecret;
  if (!secret || secret.length < 32) {
    throw new AppError("APPROVAL_SECRET_MISSING", 503, "Live actions are not configured on this server.");
  }
  const envelope = unseal("approval", input.token, secret);
  const data = approvalDataSchema.parse(envelope.data);
  if (
    data.id !== input.id ||
    data.clone !== input.clone ||
    data.mode !== input.mode ||
    data.payloadHash !== payloadHash(input.payload)
  ) {
    throw new AppError("TOKEN_MISMATCH", 403, "The approval does not match this action.");
  }
  return { nonce: envelope.nonce, expiresAt: envelope.expiresAt, payload: data.payload as ActionPayload };
}

/** Coalesces duplicate approval executions in one runtime to prevent double writes. */
export async function executeOnce<T>(key: string, expiresAt: number, operation: () => Promise<T>): Promise<T> {
  const now = Date.now();
  for (const [entryKey, entry] of executions) {
    if (entry.expiresAt <= now) executions.delete(entryKey);
  }
  const existing = executions.get(key);
  if (existing) return existing.promise as Promise<T>;
  const promise = operation();
  executions.set(key, { expiresAt, promise });
  return promise;
}
