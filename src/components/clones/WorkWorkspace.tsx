"use client";

import { AnimatePresence, motion } from "motion/react";
import { CalendarClock, Check, ListChecks, Plus, Sparkles, Target, Trash } from "lucide-react";
import { useMemo, useState } from "react";
import { runCommand } from "@/lib/agent-client";
import { freeWindows } from "@/lib/availability";
import { CLONES } from "@/lib/clones";
import { useCalendar, useClock } from "@/lib/hooks";
import { useClon } from "@/lib/store";
import { atLocal, LOCALE } from "@/lib/time";
import type { WorkTask } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AgentWorkspace } from "@/components/agent/AgentWorkspace";
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

  return (
    <AgentWorkspace
      clone="work"
      summary={
        <>
          <StatCard accent={ACCENT} label="Open tasks" value={open.length} />
          <StatCard accent={ACCENT} label="P0" value={<span className="text-accent">{open.filter((t) => t.priority === "p0").length}</span>} />
          <StatCard accent={ACCENT} label="Meetings" value={meetings.length} />
          <StatCard accent={ACCENT} label="Focus left" value={`${Math.floor(focusMinutesToday / 60)}h ${focusMinutesToday % 60}m`} />
        </>
      }
    >
      <GlassPanel accent={ACCENT}>
        <SectionHeader
          title="Priorities"
          action={
            <Button
              size="icon"
              variant="ghost"
              aria-label="Re-rank with clone"
              title="Re-rank with clone"
              disabled={!!running}
              onClick={() => runCommand("work", "What are my top priorities tomorrow?")}
            >
              <Sparkles className="h-4 w-4 text-accent" />
            </Button>
          }
        />
        <AddTask />
        {tasks.length === 0 ? (
          <EmptyState icon={ListChecks} title="No tasks yet" className="mt-3" />
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
          <SectionHeader title="Meetings" />
          {meetings.length === 0 ? (
            <EmptyState icon={CalendarClock} title="No meetings ahead" />
          ) : (
            <ul className="space-y-2">
              {meetings.map((m) => (
                <li key={m.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5" title={m.location}>
                  <div className="w-16 shrink-0">
                    <div className="font-mono text-[11px] text-ink">{tf(m.start)}</div>
                    <div className="font-mono text-[10px] text-faint">{df(m.start).split(",")[0]}</div>
                  </div>
                  <div className="min-w-0 flex-1 truncate text-[13px] text-ink">{m.title}</div>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Brief me for ${m.title}`}
                    title="Brief me"
                    disabled={!!running}
                    onClick={() => runCommand("work", `Brief me for my meeting: ${m.title}`)}
                  >
                    <Sparkles className="h-4 w-4 text-accent" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </GlassPanel>

        <GlassPanel accent={ACCENT}>
          <SectionHeader title="Focus" />
          {focus.length === 0 ? (
            <EmptyState icon={Target} title="Fully booked" />
          ) : (
            <ul className="space-y-2">
              {focus.map((f) => (
                <li key={f.start} className="rounded-xl border border-dashed border-accent-soft px-3 py-2">
                  <div className="flex items-center gap-2 font-mono text-[11px] text-accent">
                    {df(f.start).split(",")[0]} · {tf(f.start)}–{tf(f.end)}
                    <span className="ml-auto text-faint">{Math.round(f.minutes / 6) / 10}h</span>
                  </div>
                  <div className="mt-0.5 truncate text-[12.5px] text-soft">{f.task ? f.task.title : "Deep work"}</div>
                </li>
              ))}
            </ul>
          )}
          <Button
            variant="accent"
            size="sm"
            className="mt-3 w-full"
            disabled={!!running || focus.length === 0}
            title="Needs your approval"
            onClick={() => runCommand("work", "Find focus time for my top priorities and propose calendar blocks")}
          >
            <CalendarClock className="h-3.5 w-3.5" /> Propose blocks
          </Button>
        </GlassPanel>
      </div>

      <GlassPanel accent={ACCENT}>
        <SectionHeader title="Projects" />
        {projects.length === 0 ? (
          <EmptyState icon={ListChecks} title="No projects yet" />
        ) : (
          <ul className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {projects.map(([name, p]) => (
              <li key={name}>
                <div className="flex items-baseline justify-between text-[13px]">
                  <span className="truncate text-ink">{name}</span>
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
          </ul>
        )}
      </GlassPanel>
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
      className={cn("group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-white/[0.02]", done && "opacity-50")}
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
      <div
        className={cn("min-w-0 flex-1 truncate text-[13px] text-ink", done && "line-through")}
        title={[task.project, task.due && `due ${df(task.due)}`, task.estimateMin && `~${task.estimateMin} min`, task.demo ? "demo" : "yours"].filter(Boolean).join(" · ")}
      >
        {task.title}
      </div>
      <span className="hidden shrink-0 font-mono text-[10px] text-faint sm:inline">{task.project}</span>
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
