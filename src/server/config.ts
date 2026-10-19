import "server-only";

function clean(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function integer(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

export interface ServerConfig {
  approvalSecret?: string;
  publicUrl?: string;
  composio: {
    apiKey?: string;
    userId?: string;
    tools: {
      calendarList?: string;
      calendarCreate?: string;
      gmailList?: string;
      gmailDraft?: string;
    };
  };
  parallel: {
    apiKey?: string;
    processor: string;
  };
  llm: {
    apiKey?: string;
    baseUrl: string;
    model: string;
    explicitlyConfigured: boolean;
  };
  externalTimeoutMs: number;
  rateLimitPerMinute: number;
}

let cached: ServerConfig | undefined;

/** The only module that reads secrets from process.env. */
export function serverConfig(): ServerConfig {
  if (cached) return cached;

  const baseUrl = (clean(process.env.LLM_BASE_URL) ?? clean(process.env.OPENAI_BASE_URL) ?? "https://api.openai.com/v1").replace(
    /\/+$/,
    "",
  );

  const explicitModel = clean(process.env.LLM_MODEL) ?? clean(process.env.OPENAI_MODEL);
  cached = {
    approvalSecret: clean(process.env.CLON_APPROVAL_SECRET),
    publicUrl: clean(process.env.CLON_PUBLIC_URL)?.replace(/\/+$/, ""),
    composio: {
      apiKey: clean(process.env.COMPOSIO_API_KEY),
      userId: clean(process.env.COMPOSIO_USER_ID),
      tools: {
        calendarList: clean(process.env.COMPOSIO_TOOL_CALENDAR_LIST),
        calendarCreate: clean(process.env.COMPOSIO_TOOL_CALENDAR_CREATE),
        gmailList: clean(process.env.COMPOSIO_TOOL_GMAIL_LIST),
        gmailDraft: clean(process.env.COMPOSIO_TOOL_GMAIL_DRAFT),
      },
    },
    parallel: {
      apiKey: clean(process.env.PARALLEL_API_KEY),
      processor: clean(process.env.PARALLEL_PROCESSOR) ?? "base",
    },
    llm: {
      apiKey: clean(process.env.LLM_API_KEY) ?? clean(process.env.OPENAI_API_KEY),
      baseUrl,
      model: explicitModel ?? "gpt-6-astra",
      explicitlyConfigured: !!explicitModel,
    },
    externalTimeoutMs: integer(process.env.CLON_EXTERNAL_TIMEOUT_MS, 30_000, 3_000, 120_000),
    rateLimitPerMinute: integer(process.env.CLON_RATE_LIMIT_PER_MINUTE, 30, 5, 300),
  };
  return cached;
}

/** Test helper. Never call from a request handler. */
export function resetServerConfigForTests() {
  cached = undefined;
}
