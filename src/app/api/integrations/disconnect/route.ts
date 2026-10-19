import { disconnectToolkit } from "@/server/integrations/composio";
import { enforceRateLimit, enforceSameOrigin, json, jsonError, readJson, requestId } from "@/server/http";
import { integrationMutationSchema } from "@/server/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    enforceSameOrigin(request);
    enforceRateLimit(request, "integration-disconnect", 10);
    const { toolkit } = integrationMutationSchema.parse(await readJson(request));
    const result = await disconnectToolkit(toolkit, request.signal);
    return json(result, { status: 200, requestId: id });
  } catch (error) {
    return jsonError(error, id, "/api/integrations/disconnect");
  }
}

