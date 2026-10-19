import "server-only";

import { randomUUID } from "node:crypto";
import { AppError, asAppError, logServerError, publicError } from "./errors";
import { serverConfig } from "./config";

const MAX_BODY_BYTES = 256 * 1024;

type Bucket = { count: number; resetAt: number };
const runtime = globalThis as typeof globalThis & {
  __clonRateBuckets?: Map<string, Bucket>;
};
const buckets = (runtime.__clonRateBuckets ??= new Map());

export function requestId(request: Request) {
  const supplied = request.headers.get("x-request-id")?.trim();
  return supplied && /^[a-zA-Z0-9._-]{8,100}$/.test(supplied) ? supplied : randomUUID();
}

export function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "local";
}

export function enforceRateLimit(request: Request, scope: string, limit = serverConfig().rateLimitPerMinute) {
  const now = Date.now();
  if (buckets.size > 10_000) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(bucketKey);
    }
    if (buckets.size > 10_000) buckets.clear();
  }
  const key = `${scope}:${clientKey(request)}`;
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + 60_000 });
    return;
  }
  current.count += 1;
  if (current.count > limit) {
    throw new AppError("RATE_LIMITED", 429, "Too many requests. Please wait a moment and try again.", {
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    });
  }
}

export function publicOrigin(request: Request) {
  const configured = serverConfig().publicUrl;
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === "https:" || url.protocol === "http:") return url.origin;
    } catch {
      throw new AppError("INVALID_PUBLIC_URL", 503, "CLON_PUBLIC_URL is not a valid HTTP(S) URL.");
    }
  }
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host")?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProto === "https" ? "https" : new URL(request.url).protocol.replace(":", "");
  if (!host) return new URL(request.url).origin;
  return `${protocol}://${host}`;
}

/** Reject browser cross-origin mutations. Missing Origin is allowed for server-to-server clients. */
export function enforceSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host")?.trim();
  if (!host) throw new AppError("INVALID_ORIGIN", 403, "The request origin could not be verified.");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new AppError("INVALID_ORIGIN", 403, "The request origin is invalid.");
  }
  if (originHost.toLowerCase() !== host.toLowerCase()) {
    throw new AppError("INVALID_ORIGIN", 403, "Cross-origin mutations are not allowed.");
  }
}

export async function readJson(request: Request): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    throw new AppError("PAYLOAD_TOO_LARGE", 413, "The request is too large.");
  }
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) {
    throw new AppError("PAYLOAD_TOO_LARGE", 413, "The request is too large.");
  }
  if (!text.trim()) throw new AppError("EMPTY_BODY", 400, "A JSON request body is required.");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AppError("INVALID_JSON", 400, "The request body is not valid JSON.");
  }
}

export function apiHeaders(id: string, extra?: HeadersInit) {
  const headers = new Headers(extra);
  headers.set("cache-control", "no-store, max-age=0");
  headers.set("pragma", "no-cache");
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-request-id", id);
  return headers;
}

export function json(data: unknown, init: ResponseInit & { requestId: string }) {
  const { requestId: id, ...responseInit } = init;
  return Response.json(data, { ...responseInit, headers: apiHeaders(id, responseInit.headers) });
}

export function jsonError(error: unknown, id: string, route: string) {
  const appError = asAppError(error);
  logServerError(error, id, route);
  const response = json(publicError(error, id), { status: appError.status, requestId: id });
  if (appError.status === 429 && appError.details && typeof appError.details === "object") {
    const retry = (appError.details as { retryAfterSeconds?: unknown }).retryAfterSeconds;
    if (typeof retry === "number") response.headers.set("retry-after", String(retry));
  }
  return response;
}
