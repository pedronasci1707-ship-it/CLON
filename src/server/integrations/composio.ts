import "server-only";

import { Composio } from "@composio/core";
import { serverConfig } from "../config";
import { AppError } from "../errors";
import { isRecord } from "./normalize";

export type Toolkit = "gmail" | "googlecalendar";
type AccountState = "connected" | "not_connected" | "error";

export interface SemanticArguments {
  calendarId?: string;
  from?: string;
  to?: string;
  query?: string;
  maxResults?: number;
  timeZone?: string;
  title?: string;
  start?: string;
  end?: string;
  description?: string;
  location?: string;
  recipient?: string;
  subject?: string;
  body?: string;
  threadId?: string;
}

interface ExecuteUseCaseOptions {
  toolkit: Toolkit;
  useCase: string;
  preferredSlugParts: string[];
  forbiddenSlugParts?: string[];
  configuredSlug?: string;
  arguments: SemanticArguments;
  timeZone?: string;
  signal?: AbortSignal;
}

const runtime = globalThis as typeof globalThis & {
  __clonComposio?: Composio;
  __clonComposioSessions?: Map<string, { id: string; expiresAt: number }>;
};
const sessions = (runtime.__clonComposioSessions ??= new Map());

function client() {
  const config = serverConfig();
  if (!config.composio.apiKey || !config.composio.userId) {
    throw new AppError(
      "COMPOSIO_NOT_CONFIGURED",
      503,
      "Live integrations require COMPOSIO_API_KEY and COMPOSIO_USER_ID.",
    );
  }
  return (runtime.__clonComposio ??= new Composio({
    apiKey: config.composio.apiKey,
    allowTracking: false,
    dangerouslyAllowAutoUploadDownloadFiles: false,
    logLevel: "error",
  }));
}

async function session(toolkit: Toolkit, timeZone?: string, signal?: AbortSignal) {
  const composio = client();
  const userId = serverConfig().composio.userId!;
  const key = `${userId}:${toolkit}:${timeZone ?? "UTC"}`;
  const cached = sessions.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    try {
      return await composio.use(cached.id, undefined, { signal });
    } catch {
      sessions.delete(key);
    }
  }
  const created = await composio.create(
    userId,
    {
      toolkits: [toolkit],
      manageConnections: false,
      sandbox: { enable: false },
      proxyExecute: false,
      experimental: timeZone ? { assistivePrompt: { userTimezone: timeZone } } : undefined,
    },
    { signal },
  );
  sessions.set(key, { id: created.sessionId, expiresAt: Date.now() + 30 * 60_000 });
  return created;
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const aliases: Record<keyof SemanticArguments, string[]> = {
  calendarId: ["calendarid", "calendar", "calendaridentifier"],
  from: ["from", "timemin", "starttime", "startdatetime", "after", "startdate", "minstarttime"],
  to: ["to", "timemax", "endtime", "enddatetime", "before", "enddate", "maxstarttime"],
  query: ["query", "q", "searchquery", "search", "filter"],
  maxResults: ["maxresults", "limit", "pagesize", "maxitems", "count"],
  timeZone: ["timezone", "tz", "timezonename"],
  title: ["title", "summary", "eventtitle", "eventname", "name"],
  start: ["start", "starttime", "startdatetime", "fromdatetime", "begintime"],
  end: ["end", "endtime", "enddatetime", "todatetime", "finishtime"],
  description: ["description", "details", "notes", "eventdescription"],
  location: ["location", "venue", "place"],
  recipient: ["to", "recipient", "recipients", "recipientemail", "toemail", "emailaddress"],
  subject: ["subject", "emailsubject", "subjectline"],
  body: ["body", "message", "content", "emailbody", "messagetext", "text"],
  threadId: ["threadid", "gmailthreadid", "replythreadid"],
};

function schemaProperties(schema: unknown): Record<string, unknown> {
  if (!isRecord(schema)) return {};
  if (isRecord(schema.properties)) return schema.properties;
  if (isRecord(schema.parameters) && isRecord(schema.parameters.properties)) return schema.parameters.properties;
  return {};
}

function schemaType(schema: unknown) {
  return isRecord(schema) && typeof schema.type === "string" ? schema.type : undefined;
}

function coerceForSchema(value: unknown, schema: unknown, semantics: SemanticArguments) {
  const type = schemaType(schema);
  if (type === "array") {
    const itemSchema = isRecord(schema) ? schema.items : undefined;
    if (Array.isArray(value)) return value;
    if (schemaType(itemSchema) === "object" && typeof value === "string") {
      const props = schemaProperties(itemSchema);
      const emailKey = Object.keys(props).find((key) => /email|address/i.test(key));
      return [emailKey ? { [emailKey]: value } : value];
    }
    return [value];
  }
  if (type === "object" && typeof value === "string") {
    const props = schemaProperties(schema);
    const nested: Record<string, unknown> = {};
    for (const key of Object.keys(props)) {
      const normalized = normalizeKey(key);
      if (/datetime|dateandtime/.test(normalized)) nested[key] = value;
      else if (/timezone|tz/.test(normalized) && semantics.timeZone) nested[key] = semantics.timeZone;
      else if (normalized === "date") nested[key] = value.slice(0, 10);
    }
    return Object.keys(nested).length ? nested : value;
  }
  if (type === "string" && typeof value === "number") return String(value);
  if ((type === "number" || type === "integer") && typeof value === "string" && Number.isFinite(Number(value))) return Number(value);
  return value;
}

/** Adapt stable semantic fields to whatever schema the current Composio tool exposes. */
function buildArguments(schema: unknown, semantics: SemanticArguments) {
  const properties = schemaProperties(schema);
  const args: Record<string, unknown> = {};

  for (const [semantic, rawValue] of Object.entries(semantics) as [keyof SemanticArguments, unknown][]) {
    if (rawValue === undefined) continue;
    const candidates = aliases[semantic];
    const property = Object.keys(properties).find((key) => candidates.includes(normalizeKey(key)));
    if (property && args[property] === undefined) args[property] = coerceForSchema(rawValue, properties[property], semantics);
  }

  // Some calendar tools wrap the event in an `event` object.
  for (const [key, childSchema] of Object.entries(properties)) {
    if (args[key] !== undefined || schemaType(childSchema) !== "object") continue;
    if (/event|draft|message|payload|request/i.test(key)) {
      const nested = buildArguments(childSchema, semantics);
      if (Object.keys(nested).length) args[key] = nested;
    }
  }

  if (Object.keys(args).length) return args;
  // Fallback for schema-less configured tools. These canonical names are accepted by the common Gmail/Calendar tools.
  if (semantics.query) args.query = semantics.query;
  if (semantics.maxResults) args.max_results = semantics.maxResults;
  if (semantics.calendarId) args.calendar_id = semantics.calendarId;
  if (semantics.from) args.time_min = semantics.from;
  if (semantics.to) args.time_max = semantics.to;
  if (semantics.title) args.summary = semantics.title;
  if (semantics.start) args.start_datetime = semantics.start;
  if (semantics.end) args.end_datetime = semantics.end;
  if (semantics.timeZone) args.timezone = semantics.timeZone;
  if (semantics.description) args.description = semantics.description;
  if (semantics.location) args.location = semantics.location;
  if (semantics.recipient) args.to = semantics.recipient;
  if (semantics.subject) args.subject = semantics.subject;
  if (semantics.body) args.body = semantics.body;
  if (semantics.threadId) args.thread_id = semantics.threadId;
  return args;
}

function selectSlug(
  available: string[],
  preferred: string[],
  forbidden: string[],
  configured?: string,
) {
  const isForbidden = (slug: string) => forbidden.some((part) => slug.toUpperCase().includes(part.toUpperCase()));
  if (configured) {
    if (isForbidden(configured)) {
      throw new AppError("UNSAFE_TOOL_CONFIGURATION", 503, `The configured Composio tool ${configured} is not allowed for this operation.`);
    }
    return configured;
  }
  const score = (slug: string) => {
    const upper = slug.toUpperCase();
    let total = 0;
    preferred.forEach((part, index) => {
      if (upper.includes(part.toUpperCase())) total += 100 - index * 5;
    });
    forbidden.forEach((part) => {
      if (upper.includes(part.toUpperCase())) total -= 500;
    });
    return total;
  };
  const safe = [...new Set(available)].filter((slug) => !isForbidden(slug)).sort((a, b) => score(b) - score(a));
  return safe[0] && score(safe[0]) > 0 ? safe[0] : undefined;
}

export async function executeUseCase(options: ExecuteUseCaseOptions) {
  const timeout = AbortSignal.timeout(serverConfig().externalTimeoutMs);
  const operationSignal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  const activeSession = await session(options.toolkit, options.timeZone, operationSignal);
  type SearchParams = Parameters<typeof activeSession.search>[0];
  type SearchResult = ReturnType<typeof activeSession.search>;
  const searchWithSignal = activeSession.search as unknown as (
    params: SearchParams,
    requestOptions?: { signal?: AbortSignal },
  ) => SearchResult;
  const search = await searchWithSignal.call(
    activeSession,
    { query: options.useCase, toolkits: [options.toolkit] },
    { signal: operationSignal },
  );
  if (!search.success) throw new AppError("COMPOSIO_SEARCH_FAILED", 502, search.error ?? "Composio could not find a suitable tool.");
  const connection = search.toolkitConnectionStatuses.find(
    (item) => item.toolkit.toLowerCase() === options.toolkit.toLowerCase(),
  );
  if (connection && !connection.hasActiveConnection) {
    throw new AppError("INTEGRATION_NOT_CONNECTED", 424, connection.statusMessage || `${options.toolkit} is not connected.`);
  }
  const available = search.results.flatMap((result) => [...result.primaryToolSlugs, ...result.relatedToolSlugs]);
  const slug = selectSlug(available, options.preferredSlugParts, options.forbiddenSlugParts ?? [], options.configuredSlug);
  if (!slug) throw new AppError("COMPOSIO_TOOL_NOT_FOUND", 502, `No ${options.toolkit} tool matched this operation.`);

  const schema = search.toolSchemas[slug]?.inputSchema;
  const args = buildArguments(schema, options.arguments);
  type ExecuteResult = ReturnType<typeof activeSession.execute>;
  const executeWithSignal = activeSession.execute as unknown as (
    toolSlug: string,
    arguments_?: Record<string, unknown>,
    executeOptions?: Parameters<typeof activeSession.execute>[2],
    requestOptions?: { signal?: AbortSignal },
  ) => ExecuteResult;
  const result = await executeWithSignal.call(activeSession, slug, args, undefined, { signal: operationSignal });
  if (result.resultType !== "completed") {
    throw new AppError("COMPOSIO_EXECUTION_FAILED", 502, result.error || `${options.toolkit} rejected the operation.`);
  }
  return { data: result.data, slug, logId: result.logId };
}

export async function composioAccountStatuses(
  signal?: AbortSignal,
): Promise<Record<"gmail" | "googlecalendar", AccountState>> {
  const config = serverConfig();
  if (!config.composio.apiKey || !config.composio.userId) {
    return { gmail: "not_connected" as const, googlecalendar: "not_connected" as const };
  }
  try {
    const composio = client();
    const result = await composio.connectedAccounts.list(
      {
        userIds: [config.composio.userId],
        toolkitSlugs: ["gmail", "googlecalendar"],
        statuses: ["ACTIVE"],
        limit: 100,
      },
      { signal },
    );
    const active = new Set(result.items.filter((item) => !item.isDisabled && item.status === "ACTIVE").map((item) => item.toolkit.slug.toLowerCase()));
    return {
      gmail: active.has("gmail") ? ("connected" as const) : ("not_connected" as const),
      googlecalendar: active.has("googlecalendar") ? ("connected" as const) : ("not_connected" as const),
    };
  } catch {
    return { gmail: "error" as const, googlecalendar: "error" as const };
  }
}

function clearSessions(toolkit: Toolkit) {
  for (const key of sessions.keys()) {
    if (key.includes(`:${toolkit}:`)) sessions.delete(key);
  }
}

export async function createConnectionLink(toolkit: Toolkit, callbackUrl: string, signal?: AbortSignal) {
  const composio = client();
  const userId = serverConfig().composio.userId!;
  const activeSession = await composio.create(
    userId,
    {
      toolkits: [toolkit],
      manageConnections: { enable: true, callbackUrl },
      sandbox: { enable: false },
      proxyExecute: false,
    },
    { signal },
  );
  const request = await activeSession.authorize(toolkit, { callbackUrl });
  if (!request.redirectUrl) {
    throw new AppError("OAUTH_LINK_FAILED", 502, `Composio did not return an authorization URL for ${toolkit}.`);
  }
  clearSessions(toolkit);
  return { redirectUrl: request.redirectUrl };
}

export async function disconnectToolkit(toolkit: Toolkit, signal?: AbortSignal) {
  const composio = client();
  const userId = serverConfig().composio.userId!;
  const accounts = await composio.connectedAccounts.list(
    { userIds: [userId], toolkitSlugs: [toolkit], statuses: ["ACTIVE"], limit: 100 },
    { signal },
  );
  let revoked = 0;
  for (const account of accounts.items) {
    if (account.isDisabled || account.status !== "ACTIVE") continue;
    await composio.connectedAccounts.revoke(account.id, { signal });
    revoked += 1;
  }
  clearSessions(toolkit);
  return { ok: true as const, revoked };
}
