import { createConnectionLink } from "@/server/integrations/composio";
import { enforceRateLimit, enforceSameOrigin, json, jsonError, publicOrigin, readJson, requestId } from "@/server/http";
import { integrationMutationSchema } from "@/server/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    enforceSameOrigin(request);
    enforceRateLimit(request, "integration-connect", 10);
    const { toolkit } = integrationMutationSchema.parse(await readJson(request));
    const origin = publicOrigin(request);
    const result = await createConnectionLink(toolkit, `${origin}/integrations`, request.signal);
    return json(result, { status: 200, requestId: id });
  } catch (error) {
    return jsonError(error, id, "/api/integrations/connect");
  }
}
