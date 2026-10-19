import { serverConfig } from "@/server/config";
import { json, requestId } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const config = serverConfig();
  return json(
    {
      ok: true,
      service: "clon-backend",
      timestamp: new Date().toISOString(),
      capabilities: {
        composio: !!config.composio.apiKey && !!config.composio.userId,
        parallel: !!config.parallel.apiKey,
        llm: !!config.llm.apiKey && config.llm.explicitlyConfigured,
        signedApprovals: !!config.approvalSecret && config.approvalSecret.length >= 32,
      },
    },
    { status: 200, requestId: requestId(request) },
  );
}
