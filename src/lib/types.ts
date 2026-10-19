// Shared domain model used by both the client store and the server agent engine.

export type CloneId = "master" | "communication" | "work" | "life" | "fitness";
export type SpecialistId = Exclude<CloneId, "master">;

/** demo = seeded data + simulated actions. live = authenticated integrations. */
export type Mode = "demo" | "live";

/** How much a clone may do on its own. */
export type Autonomy = "read_only" | "draft" | "approval" | "limited";

/** read: no side effects · draft: reversible, private · write: changes user data · external: reaches other people */
export type Risk = "read" | "draft" | "write" | "external";

export type CalendarAccess = "none" | "read" | "propose";

export interface ClonePermissions {
  enabled: boolean;
  autonomy: Autonomy;
  calendar: CalendarAccess;
  /** Work only: allow other clones to see work event titles. */
  shareContext?: boolean;
}

export type Permissions = Record<SpecialistId, ClonePermissions>;

export interface UserProfile {
  name: string;
  city: string;
  interests: string[];
  workdayStart: number; // hour, 0-23
  workdayEnd: number;
  commStyle: "concise" | "warm" | "formal";
  budget: "$" | "$$" | "$$$";
  fitnessLevel: "beginner" | "intermediate" | "advanced";
  preferredWorkoutTime: "morning" | "midday" | "evening";
  weeklySessionGoal: number;
  weeklyMinutesGoal: number;
}

/** Something the user told CLON to remember. Kept on this device and sent with every run. */
export interface MemoryNote {
  id: string;
  text: string;
  /** "all" = every clone may use it. */
  scope: "all" | SpecialistId;
  createdAt: string;
}

export type EventCategory = "work" | "personal" | "fitness" | "social";

export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO
  end: string; // ISO
  location?: string;
  description?: string;
  category?: EventCategory;
  /** demo = seeded; clon = created by an approved CLON action (demo); google = real Google Calendar */
  source: "demo" | "clon" | "google";
  createdBy?: CloneId;
  /** Title hidden because the viewer clone lacks permission. */
  redacted?: boolean;
  link?: string;
}

export interface TimeSlot {
  start: string;
  end: string;
  minutes: number;
  score?: number;
  label?: string;
}

export interface EmailMessage {
  id: string;
  threadId?: string;
  from: { name: string; email: string };
  subject: string;
  snippet: string;
  body: string;
  receivedAt: string;
  unread: boolean;
  priority: "high" | "normal" | "low";
  category: "work" | "personal" | "updates";
  needsReply: boolean;
  meetingRequest?: boolean;
  /** Set when content tries to instruct the agent (prompt injection). */
  flagged?: string;
  demo: boolean;
}

export interface WorkTask {
  id: string;
  title: string;
  project: string;
  due?: string;
  priority: "p0" | "p1" | "p2";
  status: "todo" | "doing" | "done";
  estimateMin?: number;
  demo: boolean;
}

export type WorkoutType = "strength" | "run" | "cycle" | "yoga" | "hiit" | "walk" | "swim" | "other";

export interface Workout {
  id: string;
  type: WorkoutType;
  title: string;
  date: string; // ISO
  durationMin: number;
  intensity: "easy" | "moderate" | "hard";
  notes?: string;
  source: "demo" | "manual";
}

export interface Discovery {
  id: string;
  title: string;
  kind: "meetup" | "music" | "food" | "exhibition" | "outdoor" | "talk";
  when: string;
  area: string;
  priceHint: string;
  blurb: string;
  tags: string[];
  source: "sample";
}

export type Service = "calendar" | "gmail" | "parallel" | "llm" | "local" | "system";

export type Outcome = "success" | "simulated" | "error" | "blocked" | "pending" | "approved" | "rejected";

export interface ActivityEntry {
  id: string;
  at: string;
  clone: CloneId;
  action: string;
  service: Service;
  mode: Mode;
  outcome: Outcome;
  detail?: string;
}

export type ActionKind = "calendar.createEvents" | "gmail.createDraft";

export interface ProposedEvent {
  title: string;
  start: string;
  end: string;
  description?: string;
  category?: EventCategory;
}

export type ActionPayload =
  | { kind: "calendar.createEvents"; events: ProposedEvent[]; options?: ProposedEvent[] }
  | { kind: "gmail.createDraft"; to: string; subject: string; body: string; threadId?: string };

export interface ApprovalRequest {
  id: string;
  createdAt: string;
  clone: CloneId;
  title: string;
  summary: string;
  risk: Risk;
  mode: Mode;
  payload: ActionPayload;
  /** Server-signed token. Required to execute live actions. */
  token: string | null;
  status: "pending" | "executing" | "executed" | "rejected" | "failed";
  result?: string;
  link?: string;
  selectedOption?: number;
}

export interface AppNotification {
  id: string;
  at: string;
  kind: "approval" | "complete" | "error" | "conflict" | "update";
  title: string;
  body?: string;
  read: boolean;
  href?: string;
}

// ───────────────────────── Agent runs ─────────────────────────

export type StepStatus = "running" | "done" | "error" | "blocked" | "skipped";

export interface WorkflowStep {
  id: string;
  clone: CloneId;
  label: string;
  service?: Service;
  status: StepStatus;
  detail?: string;
  startedAt: string;
  endedAt?: string;
}

export interface EventOption {
  title: string;
  url?: string;
  when?: string;
  startISO?: string;
  venue?: string;
  summary: string;
  evidence?: string;
  dateVerified: boolean;
  fitsSchedule?: boolean;
}

export interface PlanBlock {
  start: string;
  end: string;
  title: string;
  kind: "existing" | "proposed";
  clone?: CloneId;
  note?: string;
  redacted?: boolean;
}

export type Artifact =
  | {
      kind: "calendar";
      id: string;
      title: string;
      events: CalendarEvent[];
      free: TimeSlot[];
      source: "demo" | "google";
      redactedCount?: number;
    }
  | {
      kind: "events";
      id: string;
      title: string;
      items: EventOption[];
      source: "parallel" | "sample";
      selectedIndex?: number;
      resumeToken?: string;
    }
  | {
      kind: "input";
      id: string;
      field: "recipientEmail";
      label: string;
      placeholder: string;
      token: string;
      hint?: string;
    }
  | {
      kind: "email_draft";
      id: string;
      to: string;
      subject: string;
      body: string;
      status: "created" | "simulated" | "pending_approval" | "blocked" | "failed";
      mode: Mode;
      draftId?: string;
      link?: string;
      error?: string;
      approvalId?: string;
      inReplyTo?: { from: string; subject: string; body: string; emailId: string };
    }
  | { kind: "slots"; id: string; title: string; slots: TimeSlot[]; durationMin: number }
  | {
      kind: "workout";
      id: string;
      title: string;
      type: WorkoutType;
      durationMin: number;
      intensity: Workout["intensity"];
      blocks: { name: string; detail: string }[];
      rationale: string;
      safety: string;
    }
  | { kind: "day_plan"; id: string; date: string; blocks: PlanBlock[]; conflicts: string[] }
  | {
      kind: "priorities";
      id: string;
      items: { title: string; project: string; priority: WorkTask["priority"]; due?: string; reason: string; slot?: string }[];
    }
  | {
      kind: "inbox";
      id: string;
      source: "demo" | "gmail";
      unread: number;
      needsReply: number;
      items: {
        id: string;
        from: string;
        subject: string;
        snippet: string;
        priority: EmailMessage["priority"];
        category: EmailMessage["category"];
        needsReply: boolean;
        meetingRequest?: boolean;
        flagged?: string;
      }[];
      summary?: string;
    }
  | {
      kind: "fitness_stats";
      id: string;
      days: { date: string; minutes: number; sessions: number }[];
      sessions: number;
      minutes: number;
      activeDays: number;
      streak: number;
      goalSessions: number;
      source: "demo" | "manual" | "mixed" | "none";
    }
  | { kind: "training_plan"; id: string; title: string; days: { day: string; focus: string; detail: string }[]; safety: string }
  | { kind: "brief"; id: string; meeting: string; when: string; points: string[]; related: string[] }
  | { kind: "security"; id: string; message: string; detail: string }
  | { kind: "approval"; id: string; approvalId: string };

export type RunEvent =
  | { type: "run"; runId: string; mode: Mode; planner: "rules" | "llm"; intent: string; title: string; clones: CloneId[] }
  | { type: "step"; step: WorkflowStep }
  | { type: "artifact"; artifact: Artifact }
  | { type: "approval"; approval: ApprovalRequest }
  | { type: "audit"; entry: Omit<ActivityEntry, "id" | "at"> }
  | { type: "message"; text: string }
  | { type: "done"; status: "done" | "needs_input" | "error" };

export interface ThreadMessage {
  id: string;
  role: "user" | "assistant";
  at: string;
  text: string;
  status?: "running" | "done" | "needs_input" | "error";
  mode?: Mode;
  planner?: "rules" | "llm";
  intent?: string;
  title?: string;
  clones?: CloneId[];
  steps?: WorkflowStep[];
  artifacts?: Artifact[];
}

export interface SystemStatus {
  liveAvailable: boolean;
  llm: { configured: boolean; model?: string; baseUrl?: string };
  parallel: { configured: boolean };
  composio: {
    configured: boolean;
    userId?: string;
    accounts: Record<"gmail" | "googlecalendar", "connected" | "not_connected" | "unknown" | "error">;
    error?: string;
  };
  checkedAt: string;
}
