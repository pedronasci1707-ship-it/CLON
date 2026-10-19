# CLON backend

The backend is a Next.js Node runtime with a deterministic agent engine, optional model-based intent classification, Composio integrations, Parallel research and an approval gate for writes.

## What is implemented

| Route | Purpose |
| --- | --- |
| `POST /api/agent/run` | Validates a command and streams NDJSON workflow events. |
| `POST /api/actions/execute` | Verifies and idempotently executes an approved action. |
| `GET /api/calendar/events` | Reads and privacy-redacts Google Calendar events. |
| `GET /api/mail/inbox` | Reads, normalizes and screens Gmail messages. |
| `POST /api/integrations/connect` | Starts hosted Composio OAuth for Gmail or Google Calendar. |
| `POST /api/integrations/disconnect` | Revokes active accounts for a toolkit. |
| `GET /api/system/status` | Reports safe client-visible capability and connection status. |
| `GET /api/health` | Lightweight deployment health check. |

The demo path never calls an external service. Live mode never falls back to demo data.

## Setup

1. Use Node 22.22.3 or newer. This is required by the installed Composio SDK.
2. Copy `.env.example` to `.env.local`.
3. Set `COMPOSIO_API_KEY`, `COMPOSIO_USER_ID` and a random `CLON_APPROVAL_SECRET` of at least 32 characters.
4. Connect Gmail and Google Calendar from the Integrations screen, or connect them to the same Composio user in the Composio dashboard.
5. Add `PARALLEL_API_KEY` for live event discovery.
6. Optionally add `OPENAI_API_KEY` and explicitly set `OPENAI_MODEL`. If either is missing, the rules planner remains fully functional.

The application uses the OpenAI Responses API Structured Outputs only for ambiguous intent classification. A model failure or timeout falls back to deterministic rules and never blocks the workflow.

## Security and reliability properties

- All request bodies and query parameters are schema-validated and size-limited.
- Browser mutations are same-origin only and rate-limited.
- Secrets are isolated in server-only modules and are never returned by status routes.
- Approval and resume tokens use AES-256-GCM, include a nonce and expiry, and are bound to the exact action payload.
- Duplicate live approvals coalesce into one in-flight execution in a runtime.
- Calendar writes always require approval. Gmail can only create drafts and never sends mail.
- Gmail and web content are treated as untrusted data and screened for prompt injection.
- Composio tools are discovered semantically and their current JSON input schemas are adapted at runtime. Tool slugs can also be pinned through environment variables.
- External SDKs have bounded timeouts/retries where supported, while API responses include request IDs for troubleshooting.

### Deployment note

The in-memory idempotency guard prevents duplicate writes within one running Node instance. For a horizontally scaled production deployment that can execute the same approval on two instances simultaneously, put `/api/actions/execute` behind a shared idempotency store or single-flight queue (for example Redis) keyed by the approval nonce. The encrypted token still prevents payload tampering and expires after twenty minutes.

## Smoke checks

After starting the app:

```text
GET /api/health
GET /api/system/status
```

`/api/health` should return `ok: true`. `/api/system/status` should list each account as `connected`, `not_connected`, `unknown` or `error` without exposing credentials.

Use the workflows in `docs/MVP_DEMO.md` for end-to-end acceptance.

