# CLON MVP demonstration and acceptance checklist

Run the first pass in Demo mode so it is deterministic. Repeat the marked paths in Live mode after Gmail, Google Calendar and Parallel are connected.

## 1. Master coordination

Command: `Help me organize tomorrow`

Expected:

- Master delegates to Work and Fitness.
- Priorities are ranked before the merged day plan.
- Existing calendar commitments are never moved.
- Proposed focus and workout blocks do not overlap existing events.
- One approval contains only the proposed blocks.
- Approving in Demo adds simulated events; declining changes nothing.

## 2. Calendar + discovery + invitation

Command: `Check my calendar for tonight, find relevant tech events in San Francisco, and prepare an email inviting my friend to one of them`

Expected:

- Calendar appears first with busy and free time.
- Event options appear with schedule fit. Demo options are explicitly samples; Live options have source links and date-verification labels.
- CLON asks for the friend's real email instead of inventing it.
- Choosing another event resumes the same workflow.
- The final result is a Gmail draft or a simulated draft. No email is sent.

## 3. Inbox safety and reply

Commands:

```text
Summarize my unread emails
Draft a reply to Maya with times I'm free
```

Expected:

- Inbox counts and reply-worthy messages are correct.
- The seeded malicious invoice is flagged; its instructions are not followed.
- Maya's reply uses actual free calendar windows.
- The original message and the draft appear together.
- The configured Communication autonomy is enforced.

## 4. Fitness scheduling

Command: `Find a free 45-minute workout slot tomorrow`

Expected:

- At most five ranked, non-conflicting windows appear.
- A safe workout outline accompanies the slots.
- The approval offers up to three alternative times.
- Only the selected option is created after approval.

## 5. Work and fitness read paths

Commands:

```text
What are my top priorities tomorrow?
Brief me for my next meeting
Show my training consistency over the last seven days
Create a beginner-friendly workout plan for this week
```

Expected:

- Every command produces its matching rich artifact.
- Meeting context is grounded in calendar, tasks and inbox.
- Fitness totals are computed only from logged sessions.
- Training guidance contains a safety note and no medical claim.

## Failure-path acceptance

- Missing integration: clear error, failed step and audit entry; no demo fallback in Live mode.
- Disabled clone or calendar permission: operation is blocked before any integration call.
- Invalid or expired approval: HTTP error and no external action.
- Double-click on approval: one execution in a single runtime and the same result returned to both callers.
- Parallel, model or Composio timeout: bounded failure with a request ID; the UI does not remain stuck in a running state.
- Page refresh: persisted threads, approvals and simulated calendar events rehydrate without duplicate external writes.

