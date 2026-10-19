import type { SystemStatus } from "@/lib/types";
import { serverConfig } from "@/server/config";
import { json, requestId } from "@/server/http";
import { composioAccountStatuses } from "@/server/integrations/composio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

const runtimeCache = globalThis as typeof globalThis & {
  __clonStatusCache?: { expiresAt: number; value: SystemStatus };
};

export async function GET(request: Request) {
  const id = requestId(request);
  const cached = runtimeCache.__clonStatusCache;
  if (cached && cached.expiresAt > Date.now()) return json(cached.value, { status: 200, requestId: id });

  const config = serverConfig();
  const configured = !!config.composio.apiKey && !!config.composio.userId && !!config.approvalSecret && config.approvalSecret.length >= 32;
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(7_000)]);
  const accounts = await composioAccountStatuses(signal);
  const anyConnected = accounts.gmail === "connected" || accounts.googlecalendar === "connected";
  const hasAccountError = accounts.gmail === "error" || accounts.googlecalendar === "error";
  const status: SystemStatus = {
    liveAvailable: configured && anyConnected,
    llm: {
      configured: !!config.llm.apiKey && config.llm.explicitlyConfigured,
      ...(config.llm.apiKey && config.llm.explicitlyConfigured ? { model: config.llm.model, baseUrl: config.llm.baseUrl } : {}),
    },
    parallel: { configured: !!config.parallel.apiKey },
    composio: {
      configured,
      ...(config.composio.userId ? { userId: config.composio.userId } : {}),
      accounts,
      ...(hasAccountError ? { error: "Composio connection status could not be verified." } : {}),
    },
    checkedAt: new Date().toISOString(),
  };
  runtimeCache.__clonStatusCache = { expiresAt: Date.now() + 30_000, value: status };
  return json(status, { status: 200, requestId: id });
}
