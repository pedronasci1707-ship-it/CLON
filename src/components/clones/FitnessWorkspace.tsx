"use client";

import { AnimatePresence, motion } from "motion/react";
import { CalendarClock, Dumbbell, Flame, Plus, Sparkles, Trash } from "lucide-react";
import { useMemo, useState } from "react";
import { runCommand } from "@/lib/agent-client";
import { CLONES } from "@/lib/clones";
import { useCalendar, useClock } from "@/lib/hooks";
import { useClon } from "@/lib/store";
import { atLocal, DAY, LOCALE, type Clock } from "@/lib/time";
import type { UserProfile, Workout, WorkoutType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AgentWorkspace } from "@/components/agent/AgentWorkspace";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Segmented, StatCard, Switch } from "@/components/ui/Controls";
import { GlassPanel, SectionHeader } from "@/components/ui/GlassPanel";
import { EmptyState } from "@/components/ui/States";
import { FitnessChart, type DayDatum } from "./FitnessChart";

const ACCENT = CLONES.fitness.accent;
const TYPES: WorkoutType[] = ["strength", "run", "cycle", "yoga", "hiit", "walk", "swim", "other"];
const tf = (iso: string | number) => new Date(iso).toLocaleTimeString(LOCALE, { hour: "numeric", minute: "2-digit" });
const df = (iso: string | number) => new Date(iso).toLocaleDateString(LOCALE, { weekday: "short", month: "short", day: "numeric" });

function stats(workouts: Workout[], clock: Clock) {
  const since = atLocal(clock, -6, 0);
  const recent = workouts.filter((w) => Date.parse(w.date) >= since && Date.parse(w.date) <= clock.now + DAY);
  const activeDays = new Set(recent.map((w) => new Date(w.date).toDateString())).size;
  let streak = 0;
  for (let d = 0; d < 60; d++) {
    const from = atLocal(clock, -d, 0);
    const has = workouts.some((w) => Date.parse(w.date) >= from && Date.parse(w.date) < from + DAY);
    if (has) streak++;
    else if (d > 0) break; // today may still be empty
  }
  return {
    sessions: recent.length,
    minutes: recent.reduce((s, w) => s + w.durationMin, 0),
    activeDays,
    streak,
  };
}

function Ring({ value, goal, label }: { value: number; goal: number; label: string }) {
  const pct = goal ? Math.min(1, value / goal) : 0;
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 84 84" className="h-[84px] w-[84px] shrink-0 -rotate-90">
        <circle cx="42" cy="42" r={r} fill="none" stroke="rgb(133 147 179 / 0.12)" strokeWidth="7" />
        <motion.circle
          cx="42"
          cy="42"
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          style={{ filter: "drop-shadow(0 0 6px color-mix(in oklab, var(--accent) 60%, transparent))" }}
        />
      </svg>
      <div>
        <div className="font-display text-2xl text-ink">
          {value}
          <span className="text-sm text-faint"> / {goal}</span>
        </div>
        <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-faint">{label}</div>
      </div>
    </div>
  );
}

export function FitnessWorkspace() {
  const clock = useClock(60_000);
  const mode = useClon((s) => s.mode);
  const all = useClon((s) => s.workouts);
  const profile = useClon((s) => s.profile);
  const running = useClon((s) => s.running);
  const removeWorkout = useClon((s) => s.removeWorkout);
  const cal = useCalendar("fitness", 0, 7);
  const [showDemo, setShowDemo] = useState(true);

  const includeDemo = mode === "demo" && showDemo;
  const workouts = useMemo(() => all.filter((w) => includeDemo || w.source === "manual"), [all, includeDemo]);
  const s = clock ? stats(workouts, clock) : null;

  const chartData: DayDatum[] = useMemo(() => {
    if (!clock) return [];
    return Array.from({ length: 14 }, (_, i) => {
      const from = atLocal(clock, i - 13, 0);
      const inDay = all.filter((w) => Date.parse(w.date) >= from && Date.parse(w.date) < from + DAY);
      const sum = (src: Workout["source"]) => inDay.filter((w) => w.source === src).reduce((t, w) => t + w.durationMin, 0);
      return {
        date: df(from),
        label: new Date(from).toLocaleDateString(LOCALE, { weekday: "narrow" }),
        demo: mode === "demo" ? sum("demo") : 0,
        manual: sum("manual"),
      };
    });
  }, [all, clock, mode]);

  const upcoming = useMemo(
    () =>
      clock
        ? cal.events.filter((e) => Date.parse(e.start) > clock.now && (e.category === "fitness" || e.createdBy === "fitness")).slice(0, 5)
        : [],
    [cal.events, clock],
  );

  const recent = [...workouts].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, 8);

  return (
    <AgentWorkspace
      clone="fitness"
      consoleTitle="Coach"
      summary={
        <>
          <StatCard accent={ACCENT} label="Sessions · 7d" value={s ? <span className="text-accent">{s.sessions}</span> : "—"} />
          <StatCard accent={ACCENT} label="Minutes · 7d" value={s?.minutes ?? "—"} />
          <StatCard accent={ACCENT} label="Consistency" value={s ? `${Math.round((s.activeDays / 7) * 100)}%` : "—"} />
          <StatCard accent={ACCENT} label="Streak" value={s ? `${s.streak}d` : "—"} />
        </>
      }
    >
      <GlassPanel accent={ACCENT}>
        <SectionHeader
          title="14 days"
          eyebrow="Active minutes"
          action={
            mode === "demo" ? (
              <label className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-faint" title="Include seeded demo workouts">
                Demo <Switch checked={showDemo} onChange={setShowDemo} label="Include demo data" accent={ACCENT} />
              </label>
            ) : (
              <Badge tone="cyan">Yours</Badge>
            )
          }
        />
        <FitnessChart data={chartData} showDemo={includeDemo} />
      </GlassPanel>

      <div className="grid gap-5 lg:grid-cols-2">
        <GlassPanel accent={ACCENT}>
          <SectionHeader title="Goals" />
          <div className="space-y-5">
            <Ring value={s?.sessions ?? 0} goal={profile.weeklySessionGoal} label="sessions" />
            <Ring value={s?.minutes ?? 0} goal={profile.weeklyMinutesGoal} label="minutes" />
          </div>
          <GoalsEditor />
        </GlassPanel>

        <GlassPanel accent={ACCENT}>
          <SectionHeader title="Schedule" />
          {upcoming.length === 0 ? (
            <EmptyState icon={CalendarClock} title="Nothing scheduled" />
          ) : (
            <ul className="space-y-2">
              {upcoming.map((e) => (
                <li key={e.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5">
                  <Dumbbell className="h-4 w-4 shrink-0 text-accent" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] text-ink">{e.title}</div>
                    <div className="font-mono text-[10.5px] text-faint">
                      {df(e.start)} · {tf(e.start)}–{tf(e.end)}
                    </div>
                  </div>
                  {e.source === "clon" && (
                    <span title="Added by CLON">
                      <Sparkles className="h-3.5 w-3.5 text-cyan" />
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Button variant="accent" size="sm" disabled={!!running} onClick={() => runCommand("fitness", "Find a free 45-minute workout slot tomorrow")}>
              <Sparkles className="h-3.5 w-3.5" /> 45-min slot
            </Button>
            <Button variant="outline" size="sm" disabled={!!running} onClick={() => runCommand("fitness", "Organize three gym sessions this week without conflicting with my meetings")}>
              3 sessions
            </Button>
          </div>
        </GlassPanel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <GlassPanel accent={ACCENT}>
          <SectionHeader title="Log" />
          <LogWorkout />
        </GlassPanel>

        <GlassPanel accent={ACCENT}>
          <SectionHeader title="History" />
          {recent.length === 0 ? (
            <EmptyState icon={Flame} title="No workouts yet" />
          ) : (
            <ul className="space-y-1.5">
              <AnimatePresence initial={false}>
                {recent.map((w) => (
                  <motion.li
                    key={w.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="group flex items-center gap-3 rounded-xl px-2 py-1.5"
                    title={w.source === "manual" ? "Logged by you" : "Demo"}
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent-soft font-mono text-[10px] uppercase text-accent">
                      {w.type.slice(0, 3)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] text-ink">{w.title}</div>
                      <div className="font-mono text-[10.5px] text-faint">
                        {df(w.date)} · {w.durationMin} min
                      </div>
                    </div>
                    {w.source === "manual" && (
                      <button
                        onClick={() => removeWorkout(w.id)}
                        className="text-faint opacity-0 transition-opacity hover:text-danger focus:opacity-100 group-hover:opacity-100"
                        aria-label={`Delete ${w.title}`}
                      >
                        <Trash className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </GlassPanel>
      </div>
    </AgentWorkspace>
  );
}

function LogWorkout() {
  const log = useClon((s) => s.logWorkout);
  const notify = useClon((s) => s.notify);
  const record = useClon((s) => s.recordActivity);
  const mode = useClon((s) => s.mode);
  const [type, setType] = useState<WorkoutType>("strength");
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(45);
  const [intensity, setIntensity] = useState<Workout["intensity"]>("moderate");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const [y, m, d] = date.split("-").map(Number);
        const when = new Date(y, m - 1, d, new Date().getHours(), new Date().getMinutes());
        const name = title.trim() || `${type[0].toUpperCase()}${type.slice(1)} session`;
        log({ type, title: name, durationMin: duration, intensity, date: when.toISOString(), notes: notes.trim() || undefined });
        record({ clone: "fitness", action: `Logged “${name}” · ${duration} min`, service: "local", mode, outcome: "success", detail: "Saved on this device." });
        notify({ kind: "complete", title: "Workout logged", body: `${name} · ${duration} min` });
        setTitle("");
        setNotes("");
      }}
    >
      <div className="flex flex-wrap gap-1.5">
        {TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs capitalize transition-colors",
              type === t ? "border-accent-soft bg-accent-soft text-ink" : "border-line text-mute hover:text-soft",
            )}
          >
            {t}
          </button>
        ))}
      </div>
      <input className="field" placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Workout title" />
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-mute">
          Duration
          <select className="field mt-1" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
            {[15, 20, 25, 30, 40, 45, 50, 60, 75, 90, 120].map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-mute">
          Date
          <input type="date" className="field mt-1 [color-scheme:dark]" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>
      <Segmented<Workout["intensity"]>
        size="sm"
        label="Intensity"
        value={intensity}
        onChange={setIntensity}
        options={[
          { value: "easy", label: "Easy" },
          { value: "moderate", label: "Moderate" },
          { value: "hard", label: "Hard" },
        ]}
      />
      <textarea className="field min-h-[60px] resize-none" placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} aria-label="Notes" />
      <Button type="submit" variant="accent" className="w-full">
        <Plus className="h-4 w-4" /> Log workout
      </Button>
    </form>
  );
}

function GoalsEditor() {
  const profile = useClon((s) => s.profile);
  const update = useClon((s) => s.updateProfile);
  return (
    <div className="mt-5 grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
      <label className="text-xs text-mute">
        Sessions per week
        <select className="field mt-1" value={profile.weeklySessionGoal} onChange={(e) => update({ weeklySessionGoal: Number(e.target.value) })}>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-mute">
        Minutes per week
        <select className="field mt-1" value={profile.weeklyMinutesGoal} onChange={(e) => update({ weeklyMinutesGoal: Number(e.target.value) })}>
          {[60, 90, 120, 150, 180, 240, 300].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-mute">
        Level
        <select className="field mt-1" value={profile.fitnessLevel} onChange={(e) => update({ fitnessLevel: e.target.value as UserProfile["fitnessLevel"] })}>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
      </label>
      <label className="text-xs text-mute">
        Preferred time
        <select
          className="field mt-1"
          value={profile.preferredWorkoutTime}
          onChange={(e) => update({ preferredWorkoutTime: e.target.value as UserProfile["preferredWorkoutTime"] })}
        >
          <option value="morning">Morning</option>
          <option value="midday">Midday</option>
          <option value="evening">Evening</option>
        </select>
      </label>
    </div>
  );
}
