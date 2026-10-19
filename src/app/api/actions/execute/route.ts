import { executeApprovedAction } from "@/server/actions";
import { enforceRateLimit, enforceSameOrigin, json, jsonError, readJson, requestId } from "@/server/http";
import { executeActionSchema } from "@/server/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    enforceSameOrigin(request);
    enforceRateLimit(request, "execute-action", 15);
    const parsed = executeActionSchema.parse(await readJson(request));
    const result = await executeApprovedAction(parsed, request.signal);
    return json(result, { status: 200, requestId: id });
  } catch (error) {
    return jsonError(error, id, "/api/actions/execute");
  }
}

