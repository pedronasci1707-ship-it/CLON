import "server-only";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function firstString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

export function firstBoolean(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "string" && /^(true|false)$/i.test(value)) return value.toLowerCase() === "true";
  }
  return undefined;
}

export function nestedRecord(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (isRecord(record[key])) return record[key] as Record<string, unknown>;
  }
  return undefined;
}

/** Walk JSON-like data with caps so malformed upstream payloads cannot exhaust the server. */
export function collectRecords(root: unknown, limit = 1_000, maxDepth = 8) {
  const output: Record<string, unknown>[] = [];
  const seen = new Set<object>();
  const visit = (value: unknown, depth: number) => {
    if (output.length >= limit || depth > maxDepth || !value || typeof value !== "object") return;
    if (seen.has(value as object)) return;
    seen.add(value as object);
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }
    const record = value as Record<string, unknown>;
    output.push(record);
    for (const child of Object.values(record)) visit(child, depth + 1);
  };
  visit(root, 0);
  return output;
}

export function validIso(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const ms = typeof value === "number" ? (value < 10_000_000_000 ? value * 1_000 : value) : Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : undefined;
}

export function decodeBase64Url(value: string) {
  try {
    return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  } catch {
    return "";
  }
}

export function htmlToText(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function truncateText(value: string, max: number) {
  return value.length <= max ? value : `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

