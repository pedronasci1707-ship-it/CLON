# CLON

**Your life. Your rules. Your clone.**

CLON is an open-source personal AI operating system. Instead of juggling a dozen apps, you talk to a **Master Clone**, a holographic digital second self. It coordinates four specialist clones across your connected apps:

| Clone | What it does |
| --- | --- |
| **Communication** | Triages your inbox. Detects meeting requests. Drafts replies grounded in your real availability. Never sends on its own. |
| **Work** | Ranks priorities, protects focus time and briefs you before meetings. |
| **Life** | Discovers events and experiences that fit your interests and free time, with source links. |
| **Fitness** | Plans training around your schedule, logs workouts and tracks consistency. Gives safe, non-medical guidance. |

Calendar awareness is a **shared service** that every clone uses, not a separate "schedule clone". The Master delegates, resolves conflicts between clones and **asks before acting**.

> Built for an AI hackathon around Cline, Composio, Parallel and open-source models.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

That's it. CLON opens in **Demo mode**, with a fully seeded, clearly labeled world, and needs **no API keys**.

For Live mode, copy the environment template and fill in what you have:

```bash
cp .env.example .env.local
```

Restart the server, open **Connected Apps**, and connect Google Calendar and Gmail through Composio.

Other scripts: `npm run build`, `npm start`, `npm run typecheck`.

## What to try

| Command (type it in the Master command bar, or press `Ctrl K`) | What happens |
| --- | --- |
| *Help me organize tomorrow* | The Master reads the shared calendar and asks Work, Fitness and Life for input. It returns a merged plan and one approval for the new blocks. |
| *Check my calendar for tonight, find relevant tech events in San Francisco, and prepare an email inviting my friend to one of them* | It reads tonight's availability, researches events, asks for your friend's address (it never invents one), then creates a Gmail **draft**. In Demo mode the draft is simulated. |
| *Find a free 45-minute workout slot tomorrow* | The Fitness clone queries the **same** calendar service, suggests slots and a session, and asks before adding it. |
| *Summarize my unread emails* | Inbox triage. The demo inbox includes a prompt-injection email that CLON flags and ignores. |
| *Show my training consistency over the last seven days* | Stats from your logged workouts. |

There is a step-by-step acceptance checklist in [`docs/MVP_DEMO.md`](docs/MVP_DEMO.md).

## Demo mode vs Live mode

| | Demo | Live |
| --- | --- | --- |
| Data | Seeded calendar, inbox, tasks and workouts, generated relative to today | Your Google Calendar and Gmail (via Composio), Parallel web research, your own logged tasks and workouts |
| Actions | **Simulated**, and labeled as simulated everywhere | Executed through the connected service and verified (draft id, event id) |
| Failure | n/a | Shown as an error. **Never** falls back to demo data or claims success. |

Every result carries a badge: **Demo**, **Sample**, **Live**, **Yours** (logged on this device), **Simulated** or **Done · real**.

## Architecture

```
┌────────────────────────── Browser (client) ───────────────────────────┐
│  Dashboard · Master command center · 4 clone workspaces               │
│  Activity · Approvals · Connected apps · Settings                     │
│                                                                       │
│  Zustand store (localStorage): profile, permissions, demo world,      │
│  threads, approvals, audit log, notifications                         │
│  agent-client: streams RunEvents, executes approvals via the server   │
└───────────────┬──────────────────────────────────────▲────────────────┘
                │ POST /api/agent/run (NDJSON stream)  │ RunEvent
                │ POST /api/actions/execute            │ step · artifact
                ▼                                      │ approval · audit
┌──────────────────────────────── Server ───────────────────────────────┐
│  Planner → Master orchestration → specialist workflows                │
│  Policy: permissions, autonomy, approvals (signed + encrypted tokens) │
│  Shared services: calendar · mail · research · model                  │
│  Adapters: Composio (Gmail, Google Calendar) · Parallel · LLM         │
└───────────────────────────────────────────────────────────────────────┘
```

- **One orchestrator, many specialists.** A single planner (rules-based, or an OpenAI-compatible model when configured) routes intent. Workflows then run as named steps attributed to the clone doing the work, through shared, typed services.
- **Shared calendar service.** Every clone reads availability through the same service, and every client widget through the same availability engine (`src/lib/availability.ts`). Work event titles are shown to Life and Fitness only as "Busy" unless you allow sharing.
- **Human in the loop.** Calendar writes always need approval. Gmail drafts depend on the Communication clone's autonomy level (*read only · drafts · approval required · limited*). Sending email, spending money and deleting data are not possible at all.
- **Streaming protocol.** The full client ⇄ server contract (`RunEvent`, artifacts, approvals, resumable steps) is in [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md).
- **Server details.** Configuration, security properties and smoke checks are in [`docs/BACKEND.md`](docs/BACKEND.md).

### Project structure

```
src/
  app/                    routes: /, /clones/{master,communication,work,life,fitness},
                          /activity, /approvals, /integrations, /settings, /api/*
  components/
    hologram/             MasterHologram (React Three Fiber) + SDF bust + CSS fallback
    dashboard/            AgentCard, ConnectionLines, insights
    agent/                AgentConsole, CommandBar, WorkflowProgress, ArtifactView, AgentWorkspace
    clones/               the four specialist workspaces + Master command center
    approvals/ activity/ calendar/ integrations/ shell/ ui/
  lib/                    shared types, store, client runtime, availability engine,
                          time helpers, untrusted-content guard, demo seed
  server/                 config, tokens, HTTP layer, planner/engine, actions, integrations
docs/                     API contract · backend · demo checklist
```

## Design system

- **Palette:** a deep midnight base (`#050816`) with holographic cyan `#5BE7F5` and intelligent violet `#9879FF`. Each clone has a restrained accent: Communication blue, Work indigo, Life teal, Fitness lime. Tokens live in `src/app/globals.css` (Tailwind v4 `@theme`).
- **Type:** Geist, Space Grotesk for display, and Geist Mono for system readouts.
- **Materials:** translucent glass panels with lit rims, cursor spotlights and a subtle grid-and-grain atmosphere.
- **The Master hologram** is a procedural signed-distance-field bust sampled into about 15k points. Custom shaders add rim light, scan contours, a materialize-on-load reveal and head tracking toward the cursor. It also has an interior neural mesh, orbital rings and a projector base. There are no model downloads. A CSS/SVG fallback renders while WebGL loads or when it isn't available.
- **Charts:** the Fitness chart palette was checked with a colorblind-safety validator against the dark surface. It has a legend, a tooltip and a table view.
- **Accessibility:** keyboard reachable, visible focus, `prefers-reduced-motion` respected (animations slow or stop), and color is never the only signal.

## Security model

- API keys and OAuth tokens stay on the server. The browser only sees "configured / connected" booleans.
- Live actions execute from server-issued, expiring, payload-bound approval tokens, at most once.
- Emails and web pages are treated as untrusted data. Embedded instructions are detected, flagged in the UI and never followed.
- Addresses come only from you or from the email being replied to. CLON never guesses recipients.
- You can pause any clone, change its autonomy and calendar access, switch off any integration, and inspect or export the full audit log.

## Known limitations

- **Single user, local state.** Profile, tasks, workouts, conversations and the audit log live in your browser's localStorage. There is no authentication or multi-user database yet; Supabase is the intended next step.
- **Background monitoring isn't implemented.** Clones act when you ask, not on a schedule.
- **Integrations:** Live calendar *updates* aren't supported (create only). Slack, Notion, Drive, Outlook, Strava, Garmin and health platforms are shown as *Planned* and are not connected.
- **Live mode is untested here.** It needs your own Composio, Parallel and (optionally) model credentials and hasn't been exercised in this repository without them. Demo mode is fully self-contained.
- **Fitness guidance** is general information, not medical advice.

## Suggested next steps

1. Supabase auth and per-user persistence (move the store and audit log server-side).
2. A model-driven tool-calling planner alongside the rules planner, behind the same `RunEvent` protocol.
3. Calendar update/move with diff-style approvals.
4. Scheduled briefings (morning plan, pre-meeting briefs) once background jobs exist.
5. Slack and Notion via Composio for the Work clone, and Strava or Health Connect for Fitness.

## License

[MIT](LICENSE)
