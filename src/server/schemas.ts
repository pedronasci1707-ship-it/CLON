import "server-only";

import { z } from "zod";

const iso = z.string().datetime({ offset: true });
const clone = z.enum(["master", "communication", "work", "life", "fitness"]);
const mode = z.enum(["demo", "live"]);

const clock = z.object({
  now: z.number().int().nonnegative(),
  tzOffset: z.number().int().min(-840).max(840),
  timeZone: z.string().min(1).max(100).optional(),
});

const profile = z.object({
  name: z.string().min(1).max(120),
  city: z.string().min(1).max(160),
  interests: z.array(z.string().min(1).max(80)).max(30),
  workdayStart: z.number().min(0).max(23),
  workdayEnd: z.number().min(1).max(24),
  commStyle: z.enum(["concise", "warm", "formal"]),
  budget: z.enum(["$", "$$", "$$$"]),
  fitnessLevel: z.enum(["beginner", "intermediate", "advanced"]),
  preferredWorkoutTime: z.enum(["morning", "midday", "evening"]),
  weeklySessionGoal: z.number().int().min(1).max(14),
  weeklyMinutesGoal: z.number().int().min(15).max(2_000),
});

const clonePermission = z.object({
  enabled: z.boolean(),
  autonomy: z.enum(["read_only", "draft", "approval", "limited"]),
  calendar: z.enum(["none", "read", "propose"]),
  shareContext: z.boolean().optional(),
});

const permissions = z.object({
  communication: clonePermission,
  work: clonePermission,
  life: clonePermission,
  fitness: clonePermission,
});

export const proposedEventSchema = z
  .object({
    title: z.string().min(1).max(200),
    start: iso,
    end: iso,
    description: z.string().max(5_000).optional(),
    category: z.enum(["work", "personal", "fitness", "social"]).optional(),
  })
  .superRefine((event, ctx) => {
    if (Date.parse(event.end) <= Date.parse(event.start)) {
      ctx.addIssue({ code: "custom", path: ["end"], message: "Event end must be after its start." });
    }
    if (Date.parse(event.end) - Date.parse(event.start) > 24 * 60 * 60 * 1_000) {
      ctx.addIssue({ code: "custom", path: ["end"], message: "An event cannot be longer than 24 hours." });
    }
  });

export const actionPayloadSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("calendar.createEvents"),
    events: z.array(proposedEventSchema).min(1).max(12),
    options: z.array(proposedEventSchema).min(1).max(12).optional(),
  }),
  z.object({
    kind: z.literal("gmail.createDraft"),
    to: z.string().email().max(320),
    subject: z.string().min(1).max(998),
    body: z.string().min(1).max(50_000),
    threadId: z.string().min(1).max(500).optional(),
  }),
]);

const calendarEvent = z.object({
  id: z.string().min(1).max(500),
  title: z.string().max(500),
  start: iso,
  end: iso,
  location: z.string().max(1_000).optional(),
  description: z.string().max(20_000).optional(),
  category: z.enum(["work", "personal", "fitness", "social"]).optional(),
  source: z.enum(["demo", "clon", "google"]),
  createdBy: clone.optional(),
  redacted: z.boolean().optional(),
  link: z.string().url().max(2_000).optional(),
});

const email = z.object({
  id: z.string().min(1).max(500),
  threadId: z.string().max(500).optional(),
  from: z.object({ name: z.string().max(300), email: z.string().email().max(320) }),
  subject: z.string().max(2_000),
  snippet: z.string().max(10_000),
  body: z.string().max(50_000),
  receivedAt: iso,
  unread: z.boolean(),
  priority: z.enum(["high", "normal", "low"]),
  category: z.enum(["work", "personal", "updates"]),
  needsReply: z.boolean(),
  meetingRequest: z.boolean().optional(),
  flagged: z.string().max(1_000).optional(),
  demo: z.boolean(),
});

const task = z.object({
  id: z.string().min(1).max(500),
  title: z.string().min(1).max(1_000),
  project: z.string().max(300),
  due: iso.optional(),
  priority: z.enum(["p0", "p1", "p2"]),
  status: z.enum(["todo", "doing", "done"]),
  estimateMin: z.number().int().min(1).max(100_000).optional(),
  demo: z.boolean(),
});

const workout = z.object({
  id: z.string().min(1).max(500),
  type: z.enum(["strength", "run", "cycle", "yoga", "hiit", "walk", "swim", "other"]),
  title: z.string().min(1).max(500),
  date: iso,
  durationMin: z.number().int().min(1).max(1_440),
  intensity: z.enum(["easy", "moderate", "hard"]),
  notes: z.string().max(10_000).optional(),
  source: z.enum(["demo", "manual"]),
});

const context = z.object({
  clock,
  profile,
  permissions,
  disabledIntegrations: z.array(z.string().min(1).max(100)).max(100),
  data: z.object({
    calendar: z.array(calendarEvent).max(500),
    emails: z.array(email).max(250),
    tasks: z.array(task).max(500),
    workouts: z.array(workout).max(500),
  }),
});

export const runRequestSchema = z
  .object({
    command: z.string().max(4_000),
    clone,
    mode,
    context,
    resume: z
      .object({
        token: z.string().min(20).max(40_000),
        input: z.record(z.string().max(100), z.string().max(4_000)).refine((v) => Object.keys(v).length <= 10),
      })
      .optional(),
  })
  .superRefine((request, ctx) => {
    if (!request.command.trim() && !request.resume) {
      ctx.addIssue({ code: "custom", path: ["command"], message: "A command or resume token is required." });
    }
  });

export const executeActionSchema = z.object({
  approval: z.object({
    id: z.string().min(1).max(300),
    token: z.string().max(40_000).nullable(),
    mode,
    clone,
    payload: actionPayloadSchema,
  }),
  optionIndex: z.number().int().min(0).max(11).optional(),
  clock,
});

export const calendarQuerySchema = z
  .object({
    from: iso,
    to: iso,
    viewer: clone,
    shareWork: z.enum(["true", "false"]).transform((v) => v === "true"),
  })
  .superRefine((query, ctx) => {
    const range = Date.parse(query.to) - Date.parse(query.from);
    if (range <= 0) ctx.addIssue({ code: "custom", path: ["to"], message: "Range end must be after its start." });
    if (range > 93 * 24 * 60 * 60 * 1_000) {
      ctx.addIssue({ code: "custom", path: ["to"], message: "Calendar ranges are limited to 93 days." });
    }
  });

export const integrationMutationSchema = z.object({
  toolkit: z.enum(["gmail", "googlecalendar"]),
});

export type RunRequest = z.infer<typeof runRequestSchema>;
export type ExecuteActionRequest = z.infer<typeof executeActionSchema>;
