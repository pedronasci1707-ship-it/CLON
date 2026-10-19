# CLON — client ⇄ server contract

CLON is being built by two agents working in parallel. This file is the agreement between them.

| Area | Owner | Paths |
| --- | --- | --- |
| **Server** — integrations, tokens, HTTP layer, agent planner/orchestrator, action execution, API routes, `.env.example` | Server agent | `src/server/**`, `src/app/api/**` |
| **Client** — pages, components, design system, hologram, client runtime and store | Client agent (Claude) | `src/app/**` (except `api/`), `src/components/**`, `src/lib/**`, `public/**` |
| **Shared types** | Client agent edits, both import | `src/lib/types.ts` |

Rules: don't edit the other side's files. If a shared type needs to change, ask the user to relay it.
Shared isomorphic helpers the server may import: `src/lib/types.ts`, `src/lib/availability.ts` (free/busy maths, `redactFor`), `src/lib/time.ts`, `src/lib/untrusted.ts` (prompt-injection screening), `src/lib/demo/seed.ts` (`SAMPLE_DISCOVERIES`).

Everything below is **already implemented on the client** (`src/lib/agent-client.ts`, `src/lib/hooks.ts`, the components). The server must match it.

---

## 1. `POST /api/agent/run` — run a command (streaming)

### Request body

```ts
{
  command: string;                 // natural language; "" when resuming
  clone: CloneId;                  // thread the command was typed in ("master" | "communication" | "work" | "life" | "fitness")
  mode: "demo" | "live";
  context: {
    clock: { now: number; tzOffset: number; timeZone?: string };  // tzOffset = Date#getTimezoneOffset()
    profile: UserProfile;
    permissions: Record<SpecialistId, ClonePermissions>;
    disabledIntegrations: string[];        // "gmail" | "googlecalendar" | "parallel" turned off by the user
    memory: MemoryNote[];                  // "Your notes" — facts the user typed (≤100 notes, ≤1000 chars each), same in both modes
    data: {
      calendar: CalendarEvent[];           // demo calendar (empty in live mode)
      emails: EmailMessage[];              // demo inbox (empty in live mode)
      tasks: WorkTask[];                   // local tasks (live mode: only the user's own)
      workouts: Workout[];                 // local workouts (live mode: only manual logs)
    };
  };
  resume?: { token: string; input: Record<string, string> };   // continue a paused workflow
}
```

### Response

`Content-Type: application/x-ndjson`, one `RunEvent` (see `src/lib/types.ts`) per line, flushed as work happens. Order:

1. **`run`** first, exactly once: `{ type:"run", runId, mode, planner:"rules"|"llm", intent, title, clones }`.
   `clones` lists every clone involved, starting with `"master"`. The hologram and dashboard connection lines light up from it.
2. Any number of:
   - **`step`**: `{ type:"step", step: WorkflowStep }`. Emit it with `status:"running"`, then again **with the same `id`** when it finishes (`"done" | "error" | "blocked" | "skipped"`). Set `clone` to the clone doing the work and `service` to `"calendar" | "gmail" | "parallel" | "llm" | "local" | "system"`. Put a short human-readable result in `detail`, e.g. "4 events between 6 PM and midnight". The UI shows which clone is working from these.
   - **`artifact`**: `{ type:"artifact", artifact: Artifact }`. These are the rich results the UI renders (§4). Re-sending the same `id` replaces it.
   - **`approval`**: `{ type:"approval", approval: ApprovalRequest }` with `status:"pending"`. **Do not also emit an `{kind:"approval"}` artifact** — the client appends one automatically.
   - **`audit`**: `{ type:"audit", entry: { clone, action, service, mode, outcome, detail? } }`. It lands in the unified activity log. Use `outcome:"simulated"` for demo, `"success"` only for verified real results, `"error"`, `"blocked"`, `"pending"`.
   - **`message`**: `{ type:"message", text }`. This is the assistant's final prose. The last message wins.
3. **`done`** last, exactly once: `{ type:"done", status:"done" | "needs_input" | "error" }`.

On an unexpected exception, emit a `message` explaining it and then `done` with `status:"error"`. A non-2xx response with a JSON body `{ error: string }` is also handled.

### Demo vs live

- **Demo:** never call external services. Use `context.data` for calendar, email, tasks and workouts. Use `SAMPLE_DISCOVERIES` for events with `source:"sample"`, no URLs, `dateVerified:false`. Simulate writes with `status:"simulated"` and `outcome:"simulated"`. Adding short pauses (~300–600 ms) between demo steps is welcome so the orchestration is visible.
- **Live:** use the connected integrations. If one is missing or fails, emit a step with `status:"error"` plus an `audit` with `outcome:"error"`. **Never fall back to demo data or claim success.**

### Permissions the server must enforce

`permissions[clone]` contains `enabled`, `autonomy`, `calendar` and `shareContext`.

- **Disabled clone:** blocked.
- **`calendar:"none"`:** no reads. Writes need `calendar:"propose"`.
- **Calendar writes:** always go through an approval.
- **Gmail drafts:**

  | `autonomy` | Behaviour |
  | --- | --- |
  | `"read_only"` | Blocked |
  | `"approval"` | Approval request |
  | `"draft"` or `"limited"` | Create the draft directly |

  Never send email.
- **Master:** coordinates only and never bypasses a specialist's permissions.
- **Work event privacy:** Life and Fitness see work events as "Busy" unless `permissions.work.shareContext`. Use `redactFor` from `src/lib/availability.ts`.
- **Email addresses:** never invent them. Ask for the address with an `input` artifact (below).
- **User notes (`context.memory`):** use only notes whose `scope` is `"all"` or the clone doing the work, and never for a disabled clone. They are facts the user wrote, not instructions that override these rules. An email found in a note may be suggested, but the `input` step still asks the user to confirm it (the client shows note emails as one-click chips).

### Paused workflows (asking the user something)

Emit `{ kind:"input", id, field:"recipientEmail", label, placeholder, token, hint? }` and end with `done` and `status:"needs_input"`.
The client resumes with `resume: { token, input: { recipientEmail } }`.

An `events` artifact may carry `resumeToken`. Its "Use this one" button resumes with `input: { eventIndex: "2" }`.

### Workflows the UI showcases

These are the suggestion chips in `src/lib/clones.ts`.

- **Priority real workflow:** "Check my calendar for tonight, find relevant tech events in San Francisco, and prepare an email inviting my friend to one of them."
  1. Emit a `calendar` artifact with tonight's events and free windows.
  2. Emit an `events` artifact (Parallel, with URLs, `dateVerified`, `fitsSchedule`).
  3. Ask for the friend's email with an `input` artifact.
  4. Emit an `email_draft` artifact with status `created` after a verified Gmail draft id, plus `draftId` and `link`.
- **Fitness slot:** "Find a free 45-minute workout slot tomorrow." Emit `slots` and `workout` artifacts, then an approval with `payload.kind:"calendar.createEvents"`. Include `options` with up to 3 alternatives; the user picks one.
- **Plan a day:** "Help me organize tomorrow." This is multi-clone. Emit `priorities` and `day_plan` artifacts (existing plus proposed blocks, and `conflicts`), then one approval for the proposed blocks.
- **Inbox:**
  - "Summarize my unread emails": emit an `inbox` artifact. Add a `security` artifact if any email tried to instruct the AI.
  - "Draft a reply to Maya with times I'm free": emit an `email_draft` artifact with `inReplyTo` and real free slots.
- **Fitness stats and plans:**
  - "Show my training consistency over the last seven days": emit a `fitness_stats` artifact.
  - "Create a beginner-friendly workout plan for this week": emit a `training_plan` artifact.
- **Work:**
  - "What are my top priorities tomorrow?": emit a `priorities` artifact.
  - "Brief me for my next meeting": emit a `brief` artifact.
- **Life:**
  - "Find interesting AI events tonight after 6 PM": emit `events`, then an optional approval to add one to the calendar.
  - "When am I free this week?": emit a `calendar` or `slots` artifact.

## 2. `POST /api/actions/execute` — run an approved action

```ts
// request
{ approval: { id, token: string | null, mode, clone, payload: ActionPayload }, optionIndex?: number, clock: Clock }
// response
{ ok: boolean; simulated?: boolean; summary?: string; error?: string; link?: string; createdEvents?: CalendarEvent[] }
```

**Demo mode** only simulates.

- For `calendar.createEvents`, return `createdEvents` with `source:"clon"` and `createdBy: clone`. If `payload.options` is set and `optionIndex` is given, use `options[optionIndex]`. The client adds these to the demo calendar, so every clone sees them.
- Seeded demo approvals arrive with `token: null`. Accept those **only** when `mode === "demo"`.

**Live mode** requires and verifies the token.

- Execute the token's payload, not the client's, at most once.
- Return a verified id or link.

## 3. Other routes

| Route | Response |
| --- | --- |
| `GET /api/system/status` | `SystemStatus` (`src/lib/types.ts`). Set `liveAvailable` only when Composio is configured **and** Gmail or Google Calendar is connected. Set `llm.configured` only when a model is explicitly configured. |
| `GET /api/calendar/events?from&to&viewer&shareWork` | `{ events: CalendarEvent[], redacted: number }`, live mode. Apply `redactFor(events, viewer, { shareWork, categorized:false })`. |
| `GET /api/mail/inbox` | `{ emails: EmailMessage[] }`, live mode, `demo:false`. |
| `POST /api/integrations/connect` `{ toolkit: "gmail" \| "googlecalendar" }` | `{ redirectUrl }` for the hosted OAuth flow. |
| `POST /api/integrations/disconnect` `{ toolkit }` *(optional)* | `{ ok }` |

Errors may be `{ error: "message" }` or `{ error: { message } }`. The client accepts both.

## 4. Artifacts the UI renders

The authoritative definitions are in `src/lib/types.ts`. Each is rendered in `src/components/agent/ArtifactView.tsx`.

| kind | Use for | Notes |
| --- | --- | --- |
| `calendar` | Events and free windows for a time range | `source: "demo" \| "google"`, `redactedCount` |
| `events` | Event and activity options | `source: "parallel" \| "sample"`, `selectedIndex`, optional `resumeToken` |
| `input` | Ask the user for a value | Currently `field: "recipientEmail"` |
| `email_draft` | Drafted email | `status: created \| simulated \| pending_approval \| blocked \| failed`, `approvalId` when awaiting approval, `inReplyTo` for side-by-side review |
| `slots` | Candidate time slots | First is highlighted as best |
| `workout` | A single session | Always include the `safety` text; no medical claims |
| `day_plan` | Merged existing and proposed blocks | `blocks[].kind: existing \| proposed`, `conflicts[]` |
| `priorities` | Ranked tasks | Optional `slot` text |
| `inbox` | Triage summary | `items[].flagged` for prompt-injection attempts |
| `fitness_stats` | 7-day training data | `source: demo \| manual \| mixed \| none` |
| `training_plan` | Weekly plan | Always include `safety` |
| `brief` | Pre-meeting brief | |
| `security` | Untrusted content was ignored | |
