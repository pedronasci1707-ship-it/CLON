import { readInbox } from "@/server/integrations/mail";
import { enforceRateLimit, json, jsonError, requestId } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    enforceRateLimit(request, "mail-read", 60);
    const result = await readInbox({ signal: request.signal });
    return json({ emails: result.emails, source: result.source }, { status: 200, requestId: id });
  } catch (error) {
    return jsonError(error, id, "/api/mail/inbox");
  }
}

