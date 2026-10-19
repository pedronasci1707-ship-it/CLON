"use client";

import { AnimatePresence, motion } from "motion/react";
import { Briefcase, CalendarClock, Check, ListChecks, Plus, Sparkles, Target, Trash } from "lucide-react";
import { useMemo, useState } from "react";
import { runCommand } from "@/lib/agent-client";
import { freeWindows } from "@/lib/availability";
import { CLONES } from "@/lib/clones";
import { useCalendar, useClock, useInbox } from "@/lib/hooks";
import { useClon } from "@/lib/store";
import { atLocal, LOCALE, timeAgo } from "@/lib/time";
import type { WorkTask } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AgentWorkspace } from "@/components/agent/AgentWorkspace";
import { Badge, ModeBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/Controls";
import { GlassPanel, SectionHeader } from "@/components/ui/GlassPanel";
import { EmptyState } from "@/components/ui/States";

const ACCENT = CLONES.work.accent;
const PRIORITY_RANK = { p0: 0, p1: 1, p2: 2 } as const;
const tf = (iso: string | number) => new Date(iso).toLocaleTimeString(LOCALE, { hour: "numeric", minute: "2-digit" });
const df = (iso: string) => new Date(iso).toLocaleDateString(LOCALE, { weekday: "short", month: "short", day: "numeric" });

export function WorkWorkspace() {
  const clock = useClock(60_000);
  const mode = useClon((s) => s.mode);
  const allTasks = useClon((s) => s.tasks);
  const profile = useClon((s) => s.profile);
  const running = useClon((s) => s.running);
  const cal = useCalendar("work", 0, 2);
  const inbox = useInbox();

  const tasks = useMemo(
    () =>
      (mode === "live" ? allTasks.filter((t) => !t.demo) : allTasks).slice().sort((a, b) => {
        if ((a.status === "done") !== (b.status === "done")) return a.status === "done" ? 1 : -1;
        return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || (Date.parse(a.due ?? "9999") - Date.parse(b.due ?? "9999"));
      }),
    [allTasks, mode],
  );
  const open = tasks.filter((t) => t.status !== "done");

  const meetings = useMemo(
    () => (clock ? cal.events.filter((e) => Date.parse(e.end) > clock.now && (e.category === "work" || e.source === "google")).slice(0, 5) : []),
    [cal.events, clock],
  );

  const focus = useMemo(() => {
    if (!clock) return [];
    const windows = [0, 1].flatMap((d) =>
      freeWindows(cal.events, Math.max(clock.now, atLocal(clock, d, profile.workdayStart)), atLocal(clock, d, profile.workdayEnd), 45, 5),
    );
    return windows.slice(0, 4).map((w, i) => ({ ...w, task: open[i] }));
  }, [cal.events, clock, open, profile.workdayStart, profile.workdayEnd]);

  const focusMinutesToday = clock
    ? freeWindows(cal.events, Math.max(clock.now, atLocal(clock, 0, profile.workdayStart)), atLocal(clock, 0, profile.workdayEnd), 30, 5).reduce((s, w) => s + w.minutes, 0)
    : 0;

  const projects = useMemo(() => {
    const map = new Map<string, { total: number; done: number }>();
    tasks.forEach((t) => {
      const p = map.get(t.project) ?? { total: 0, done: 0 };
      p.total++;
      if (t.status === "done") p.done++;
      map.set(t.project, p);
    });
    return [...map.entries()];
  }, [tasks]);

  const workEmails = inbox.emails.filter((e) => e.category === "work" && !e.flagged).slice(0, 4);

  return (
    <AgentWorkspace
      clone="work"
      summary={
        <>
          <StatCard accent={ACCENT} label="Open tasks" value={open.length} hint={`${tasks.length - open.length} completed`} />
          <StatCard accent={ACCENT} label="Top priority" value={<span className="text-accent">{open.filter((t) => t.priority === "p0").length}</span>} hint="P0 items open" />
          <StatCard accent={ACCENT} label="Meetings ahead" value={meetings.length} hint={meetings[0] ? `Next: ${tf(meetings[0].start)}` : "None scheduled"} />
          <StatCard accent={ACCENT} label="Focus left today" value={`${Math.floor(focusMinutesToday / 60)}h ${focusMinutesToday % 60}m`} hint="Free time within work hours" />
        </>
      }
    >
      <GlassPanel accent={ACCENT}>
        <SectionHeader
          eyebrow="Today's priorities"
          title="Ranked by priority and deadline"
          action={
            <Button size="sm" variant="ghost" disabled={!!running} onClick={() => runCommand("work", "What are my top priorities tomorrow?")}>
              <Sparkles className="h-3.5 w-3.5" /> Re-rank with clone
            </Button>
          }
        />
        <AddTask />
        {tasks.length === 0 ? (
          <EmptyState icon={ListChecks} title="No tasks yet" body="Add what's on your plate — your Work clone will rank it and find focus time." className="mt-3" />
        ) : (
          <ul className="mt-3 space-y-1.5">
            <AnimatePresence initial={false}>
              {tasks.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </GlassPanel>

      <div className="grid gap-5 lg:grid-cols-2">
        <GlassPanel accent={ACCENT}>
          <SectionHeader eyebrow="Shared calendar" title="Upcoming meetings" action={<ModeBadge mode={cal.source === "google" ? "live" : "demo"} />} />
          {meetings.length === 0 ? (
            <EmptyState icon={CalendarClock} title="No meetings ahead" />
          ) : (
            <ul className="space-y-2">
              {meetings.map((m) => (
                <li key={m.id} className="flex items-center gap-3 rounded-xl border border-line bg-white/[0.015] px-3 py-2.5">
                  <div className="w-16 shrink-0">
                    <div className="font-mono text-[11px] text-ink">{tf(m.start)}</div>
                    <div className="font-mono text-[10px] text-faint">{df(m.start).split(",")[0]}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] text-ink">{m.title}</div>
                    {m.location && <div className="truncate text-[11px] text-mute">{m.location}</div>}
                  </div>
                  <Button size="sm" variant="ghost" disabled={!!running} onClick={() => runCommand("work", `Brief me for my meeting: ${m.title}`)}>
                    Brief me
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </GlassPanel>

        <GlassPanel accent={ACCENT}>
          <SectionHeader eyebrow="Recommendations" title="Protect focus time" />
          {focus.length === 0 ? (
            <EmptyState icon={Target} title="No focus windows" body="Your work hours are fully booked for the next two days." />
          ) : (
            <ul className="space-y-2">
              {focus.map((f) => (
                <li key={f.start} className="rounded-xl border border-dashed border-accent-soft px-3 py-2.5">
                  <div className="flex items-center gap-2 font-mono text-[11px] text-accent">
                    {df(f.start).split(",")[0]} · {tf(f.start)}–{tf(f.end)}
                    <span className="ml-auto text-faint">{Math.round(f.minutes / 6) / 10}h free</span>
                  </div>
                  <div className="mt-1 text-[12.5px] text-soft">
                    {f.task ? (
                      <>
                        Block for <span className="text-ink">{f.task.title}</span>
                        {f.task.estimateMin ? ` (~${f.task.estimateMin} min)` : ""}
                      </>
                    ) : (
                      "Deep work or catch-up"
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Button
            variant="accent"
            size="sm"
            className="mt-3 w-full"
            disabled={!!running || focus.length === 0}
            onClick={() => runCommand("work", "Find focus time for my top priorities and propose calendar blocks")}
          >
            <CalendarClock className="h-3.5 w-3.5" /> Propose focus blocks (needs approval)
          </Button>
        </GlassPanel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <GlassPanel accent={ACCENT}>
          <SectionHeader eyebrow="Active projects" title="Progress by project" />
          <ul className="space-y-3">
            {projects.map(([name, p]) => (
              <li key={name}>
                <div className="flex items-baseline justify-between text-[13px]">
                  <span className="text-ink">{name}</span>
                  <span className="font-mono text-[11px] text-mute">
                    {p.done}/{p.total}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                  <motion.div
                    className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent),#a5aaff)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${(p.done / p.total) * 100}%` }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
              </li>
            ))}
            {projects.length === 0 && <li className="text-xs text-mute">Projects appear as you add tasks.</li>}
          </ul>
        </GlassPanel>

        <GlassPanel accent={ACCENT}>
          <SectionHeader eyebrow="Professional communications" title="Work threads" action={<ModeBadge mode={inbox.source === "gmail" ? "live" : "demo"} />} />
          {workEmails.length === 0 ? (
            <EmptyState icon={Briefcase} title="No work email" />
          ) : (
            <ul className="space-y-2">
              {workEmails.map((e) => (
                <li key={e.id} className="rounded-xl border border-line bg-white/[0.015] px-3 py-2">
                  <div className="flex items-center gap-2 text-[12.5px]">
                    <span className="truncate text-ink">{e.from.name}</span>
                    {e.needsReply && <Badge tone="accent">Reply</Badge>}
                    <span className="ml-auto shrink-0 font-mono text-[10px] text-faint">{timeAgo(e.receivedAt)}</span>
                  </div>
                  <div className="truncate text-[12px] text-mute">{e.subject}</div>
                </li>
              ))}
            </ul>
          )}
        </GlassPanel>
      </div>
    </AgentWorkspace>
  );
}

function TaskRow({ task }: { task: WorkTask }) {
  const toggle = useClon((s) => s.toggleTask);
  const remove = useClon((s) => s.removeTask);
  const done = task.status === "done";
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className={cn("group flex items-center gap-3 rounded-xl border border-line bg-white/[0.015] px-3 py-2.5", done && "opacity-50")}
    >
      <button
        onClick={() => toggle(task.id)}
        aria-label={done ? `Mark “${task.title}” as not done` : `Complete “${task.title}”`}
        className={cn(
          "grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors",
          done ? "border-accent-soft bg-accent-soft text-accent" : "border-line-strong hover:border-accent-soft",
        )}
      >
        {done && <Check className="h-3 w-3" strokeWidth={3} />}
      </button>
      <span className={cn("shrink-0 font-mono text-[10px] uppercase", task.priority === "p0" ? "text-danger" : task.priority === "p1" ? "text-warn" : "text-mute")}>
        {task.priority}
      </span>
      <div className="min-w-0 flex-1">
        <div className={cn("truncate text-[13px] text-ink", done && "line-through")}>{task.title}</div>
        <div className="truncate text-[11px] text-mute">
          {task.project}
          {task.due ? ` · due ${df(task.due)}` : ""}
          {task.estimateMin ? ` · ~${task.estimateMin} min` : ""}
        </div>
      </div>
      {task.demo ? <ModeBadge mode="demo" /> : <ModeBadge mode="manual" />}
      <button
        onClick={() => remove(task.id)}
        className="text-faint opacity-0 transition-opacity hover:text-danger focus:opacity-100 group-hover:opacity-100"
        aria-label={`Remove “${task.title}”`}
      >
        <Trash className="h-3.5 w-3.5" />
      </button>
    </motion.li>
  );
}

function AddTask() {
  const add = useClon((s) => s.addTask);
  const [title, setTitle] = useState("");
  const [project, setProject] = useState("General");
  const [priority, setPriority] = useState<WorkTask["priority"]>("p1");
  const [estimate, setEstimate] = useState(30);
  return (
    <form
      className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_140px_88px_96px_auto]"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        add({ title: title.trim(), project: project.trim() || "General", priority, estimateMin: estimate });
        setTitle("");
      }}
    >
      <input className="field col-span-2 sm:col-span-1" placeholder="Add a task…" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Task title" />
      <input className="field" placeholder="Project" value={project} onChange={(e) => setProject(e.target.value)} aria-label="Project" />
      <select className="field" value={priority} onChange={(e) => setPriority(e.target.value as WorkTask["priority"])} aria-label="Priority">
        <option value="p0">P0</option>
        <option value="p1">P1</option>
        <option value="p2">P2</option>
      </select>
      <select className="field" value={estimate} onChange={(e) => setEstimate(Number(e.target.value))} aria-label="Estimate">
        {[15, 30, 45, 60, 90, 120].map((m) => (
          <option key={m} value={m}>
            {m} min
          </option>
        ))}
      </select>
      <Button type="submit" variant="accent" disabled={!title.trim()} className="col-span-2 sm:col-span-1">
        <Plus className="h-4 w-4" /> Add
      </Button>
    </form>
  );
}
