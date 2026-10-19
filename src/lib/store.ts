"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  ActivityEntry,
  AppNotification,
  ApprovalRequest,
  CalendarEvent,
  CloneId,
  ClonePermissions,
  EmailMessage,
  Mode,
  Permissions,
  SpecialistId,
  SystemStatus,
  ThreadMessage,
  UserProfile,
  WorkTask,
  Workout,
} from "./types";
import {
  DEMO_PROFILE,
  seedActivity,
  seedApprovals,
  seedCalendar,
  seedEmails,
  seedReplyDraft,
  seedTasks,
  seedWorkouts,
} from "./demo/seed";
import { browserClock } from "./time";
import { uid } from "./utils";

export const DEFAULT_PERMISSIONS: Permissions = {
  communication: { enabled: true, autonomy: "draft", calendar: "read" },
  work: { enabled: true, autonomy: "approval", calendar: "propose", shareContext: false },
  life: { enabled: true, autonomy: "approval", calendar: "propose" },
  fitness: { enabled: true, autonomy: "approval", calendar: "propose" },
};

export interface DraftRecord {
  emailId: string;
  to: string;
  subject: string;
  body: string;
  status: "created" | "simulated" | "pending_approval" | "blocked" | "failed";
  mode: Mode;
  at: string;
  link?: string;
}

export interface RunningState {
  clone: CloneId;
  activeClones: CloneId[];
  label: string;
}

interface ClonState {
  hydrated: boolean;
  seededAt: string | null;
  mode: Mode;
  profile: UserProfile;
  permissions: Permissions;
  calendar: CalendarEvent[];
  emails: EmailMessage[];
  tasks: WorkTask[];
  workouts: Workout[];
  activity: ActivityEntry[];
  approvals: ApprovalRequest[];
  notifications: AppNotification[];
  threads: Record<CloneId, ThreadMessage[]>;
  drafts: Record<string, DraftRecord>;
  disabledIntegrations: string[];
  running: RunningState | null;
  system: SystemStatus | null;

  seed: (force?: boolean) => void;
  setMode: (mode: Mode) => void;
  updateProfile: (p: Partial<UserProfile>) => void;
  setPermission: (clone: SpecialistId, p: Partial<ClonePermissions>) => void;
  addCalendarEvents: (events: CalendarEvent[]) => void;
  addTask: (t: Omit<WorkTask, "id" | "demo" | "status">) => void;
  toggleTask: (id: string) => void;
  removeTask: (id: string) => void;
  logWorkout: (w: Omit<Workout, "id" | "source">) => void;
  removeWorkout: (id: string) => void;
  markEmailRead: (id: string) => void;
  recordActivity: (e: Omit<ActivityEntry, "id" | "at">) => void;
  clearActivity: () => void;
  addApproval: (a: ApprovalRequest) => void;
  updateApproval: (id: string, p: Partial<ApprovalRequest>) => void;
  notify: (n: Omit<AppNotification, "id" | "at" | "read">) => void;
  markNotificationsRead: () => void;
  dismissNotification: (id: string) => void;
  appendMessage: (clone: CloneId, m: ThreadMessage) => void;
  patchMessage: (clone: CloneId, id: string, fn: (m: ThreadMessage) => ThreadMessage) => void;
  clearThread: (clone: CloneId) => void;
  saveDraft: (d: DraftRecord) => void;
  toggleIntegration: (key: string) => void;
  setRunning: (r: RunningState | null) => void;
  setSystem: (s: SystemStatus | null) => void;
}

const emptyThreads = (): Record<CloneId, ThreadMessage[]> => ({
  master: [],
  communication: [],
  work: [],
  life: [],
  fitness: [],
});

const now = () => new Date().toISOString();

export const useClon = create<ClonState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      seededAt: null,
      mode: "demo",
      profile: DEMO_PROFILE,
      permissions: DEFAULT_PERMISSIONS,
      calendar: [],
      emails: [],
      tasks: [],
      workouts: [],
      activity: [],
      approvals: [],
      notifications: [],
      threads: emptyThreads(),
      drafts: {},
      disabledIntegrations: [],
      running: null,
      system: null,

      seed: (force = false) => {
        const s = get();
        // Re-seed when forced, on first run, or when the demo world has gone stale (> 20h old).
        const stale = s.seededAt ? Date.now() - Date.parse(s.seededAt) > 20 * 3_600_000 : true;
        if (!force && !stale) {
          // Backfill the demo reply draft for worlds seeded before it existed.
          if (!s.drafts.demo_mail_1 && s.emails.some((e) => e.id === "demo_mail_1")) {
            const d = seedReplyDraft(browserClock(), s.calendar);
            set({ drafts: { ...s.drafts, [d.emailId]: d } });
          }
          return;
        }
        const clock = browserClock();
        const keepUserTasks = s.tasks.filter((t) => !t.demo);
        const keepManual = s.workouts.filter((w) => w.source === "manual");
        const keepClonEvents = force ? [] : s.calendar.filter((e) => e.source === "clon" && Date.parse(e.end) > clock.now);
        const calendar = [...seedCalendar(clock), ...keepClonEvents];
        const demoDraft = seedReplyDraft(clock, calendar);
        set({
          seededAt: now(),
          calendar,
          emails: seedEmails(clock),
          tasks: [...seedTasks(clock), ...(force ? [] : keepUserTasks)],
          workouts: [...seedWorkouts(clock), ...(force ? [] : keepManual)],
          activity: force || s.activity.length === 0 ? seedActivity(clock) : s.activity,
          approvals: force || s.approvals.length === 0 ? seedApprovals(clock) : s.approvals,
          drafts: force ? { [demoDraft.emailId]: demoDraft } : { [demoDraft.emailId]: demoDraft, ...s.drafts },
          threads: force ? emptyThreads() : s.threads,
          notifications: force ? [] : s.notifications,
          profile: force ? DEMO_PROFILE : s.profile,
          permissions: force ? DEFAULT_PERMISSIONS : s.permissions,
        });
      },

      setMode: (mode) => set({ mode }),
      updateProfile: (p) => set((s) => ({ profile: { ...s.profile, ...p } })),
      setPermission: (clone, p) =>
        set((s) => ({ permissions: { ...s.permissions, [clone]: { ...s.permissions[clone], ...p } } })),

      addCalendarEvents: (events) => set((s) => ({ calendar: [...s.calendar, ...events] })),

      addTask: (t) =>
        set((s) => ({ tasks: [{ ...t, id: uid("task"), status: "todo", demo: false }, ...s.tasks] })),
      toggleTask: (id) =>
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, status: t.status === "done" ? "todo" : "done" } : t)),
        })),
      removeTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

      logWorkout: (w) =>
        set((s) => ({ workouts: [{ ...w, id: uid("wo"), source: "manual" }, ...s.workouts] })),
      removeWorkout: (id) => set((s) => ({ workouts: s.workouts.filter((w) => w.id !== id) })),

      markEmailRead: (id) =>
        set((s) => ({ emails: s.emails.map((e) => (e.id === id ? { ...e, unread: false } : e)) })),

      recordActivity: (e) =>
        set((s) => ({ activity: [{ ...e, id: uid("act"), at: now() }, ...s.activity].slice(0, 300) })),
      clearActivity: () => set({ activity: [] }),

      addApproval: (a) => set((s) => ({ approvals: [a, ...s.approvals.filter((x) => x.id !== a.id)] })),
      updateApproval: (id, p) =>
        set((s) => ({ approvals: s.approvals.map((a) => (a.id === id ? { ...a, ...p } : a)) })),

      notify: (n) =>
        set((s) => ({ notifications: [{ ...n, id: uid("ntf"), at: now(), read: false }, ...s.notifications].slice(0, 50) })),
      markNotificationsRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
      dismissNotification: (id) => set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),

      appendMessage: (clone, m) =>
        set((s) => ({ threads: { ...s.threads, [clone]: [...s.threads[clone], m].slice(-40) } })),
      patchMessage: (clone, id, fn) =>
        set((s) => ({ threads: { ...s.threads, [clone]: s.threads[clone].map((m) => (m.id === id ? fn(m) : m)) } })),
      clearThread: (clone) => set((s) => ({ threads: { ...s.threads, [clone]: [] } })),

      saveDraft: (d) => set((s) => ({ drafts: { ...s.drafts, [d.emailId]: d } })),
      toggleIntegration: (key) =>
        set((s) => ({
          disabledIntegrations: s.disabledIntegrations.includes(key)
            ? s.disabledIntegrations.filter((k) => k !== key)
            : [...s.disabledIntegrations, key],
        })),

      setRunning: (running) => set({ running }),
      setSystem: (system) => set({ system }),
    }),
    {
      name: "clon-state-v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: ({ hydrated: _h, running: _r, system: _s, ...rest }) => rest,
    },
  ),
);
