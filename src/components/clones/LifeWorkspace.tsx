"use client";

import { motion } from "motion/react";
import { Clock, Compass, ExternalLink, MapPin, Plus, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import { runCommand } from "@/lib/agent-client";
import { freeWindows } from "@/lib/availability";
import { CLONES } from "@/lib/clones";
import { SAMPLE_DISCOVERIES } from "@/lib/demo/seed";
import { useCalendar, useClock } from "@/lib/hooks";
import { useClon } from "@/lib/store";
import { atLocal, localWeekday, LOCALE } from "@/lib/time";
import type { Discovery, EventOption, UserProfile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AgentWorkspace } from "@/components/agent/AgentWorkspace";
import { Badge, ModeBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Controls";
import { GlassPanel, SectionHeader } from "@/components/ui/GlassPanel";
import { EmptyState } from "@/components/ui/States";

const ACCENT = CLONES.life.accent;
const tf = (iso: string | number) => new Date(iso).toLocaleTimeString(LOCALE, { hour: "numeric", minute: "2-digit" });

const ART: Record<Discovery["kind"], [string, string, string]> = {
  meetup: ["#3fd8c4", "#5be7f5", "#0e3b4a"],
  talk: ["#5aa8ff", "#9879ff", "#1a2350"],
  music: ["#9879ff", "#ff7ad9", "#2a1450"],
  exhibition: ["#8088ff", "#ff9f7a", "#2a1c40"],
  outdoor: ["#3fd8c4", "#c4f25f", "#0f3a32"],
  food: ["#ffc56b", "#ff7a7a", "#3d2216"],
};

/** Generative cover art — no stock imagery, unique per experience type. */
function Cover({ kind, seed, className }: { kind: Discovery["kind"]; seed: number; className?: string }) {
  const [a, b, base] = ART[kind];
  return (
    <div
      className={cn("relative overflow-hidden", className)}
      style={{
        background: `radial-gradient(120% 90% at ${20 + (seed * 37) % 60}% 0%, ${a}55, transparent 60%), radial-gradient(90% 80% at 100% 100%, ${b}44, transparent 60%), linear-gradient(160deg, ${base}, #070b1c)`,
      }}
      aria-hidden
    >
      <svg className="absolute inset-0 h-full w-full opacity-50" viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice">
        {Array.from({ length: 9 }).map((_, i) => (
          <circle
            key={i}
            cx={300 - (seed * 23) % 120}
            cy={60 + (seed * 13) % 80}
            r={18 + i * 22}
            fill="none"
            stroke={i % 2 ? a : b}
            strokeOpacity={0.5 - i * 0.045}
            strokeWidth="0.8"
            strokeDasharray={i % 3 === 0 ? "2 6" : undefined}
          />
        ))}
        {Array.from({ length: 24 }).map((_, i) => (
          <line key={`l${i}`} x1={i * 18} y1="240" x2={i * 18 + 60} y2="140" stroke={a} strokeOpacity="0.08" />
        ))}
      </svg>
      <div className="scanlines absolute inset-0 opacity-40" />
    </div>
  );
}

export function LifeWorkspace() {
  const clock = useClock(60_000);
  const profile = useClon((s) => s.profile);
  const threads = useClon((s) => s.threads);
  const running = useClon((s) => s.running);
  const cal = useCalendar("life", 0, 6);

  const freeTime = useMemo(() => {
    if (!clock) return [];
    const weekday = localWeekday(clock.now, clock.tzOffset);
    const toSat = (6 - weekday + 7) % 7;
    const slots = [
      { label: "Tonight", from: Math.max(clock.now, atLocal(clock, 0, 17)), to: atLocal(clock, 0, 23, 30) },
      { label: "Tomorrow evening", from: atLocal(clock, 1, 17), to: atLocal(clock, 1, 23, 30) },
      { label: toSat === 0 ? "Today (Saturday)" : "Saturday", from: atLocal(clock, toSat, 10), to: atLocal(clock, toSat, 23) },
    ];
    return slots.map((s) => ({ label: s.label, windows: s.from < s.to ? freeWindows(cal.events, s.from, s.to, 60) : [] }));
  }, [clock, cal.events]);

  const latest = useMemo(() => {
    const all = [...threads.life, ...threads.master]
      .filter((m) => m.role === "assistant")
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
    for (const m of all) {
      const art = m.artifacts?.find((a) => a.kind === "events");
      if (art && art.kind === "events" && art.items.length) return { art, at: m.at };
    }
    return null;
  }, [threads]);

  const [featured, ...rest] = SAMPLE_DISCOVERIES;

  return (
    <AgentWorkspace clone="life">
      {/* Editorial hero */}
      <section className="relative overflow-hidden rounded-[26px] border border-line">
        <Cover kind="meetup" seed={3} className="absolute inset-0 opacity-70" />
        <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-accent">
              <MapPin className="h-3 w-3" /> Exploring
            </div>
            <h2 className="mt-2 font-display text-5xl font-medium leading-[0.95] tracking-tight text-ink sm:text-6xl">{profile.city}</h2>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="accent" size="sm" disabled={!!running} onClick={() => runCommand("life", `Find interesting AI events tonight after 6 PM in ${profile.city}`)}>
                <Sparkles className="h-3.5 w-3.5" /> AI tonight
              </Button>
              <Button variant="outline" size="sm" disabled={!!running} onClick={() => runCommand("life", "Plan something fun for Saturday evening")}>
                Saturday
              </Button>
              <Button variant="outline" size="sm" disabled={!!running} onClick={() => runCommand("life", "When am I free this week?")}>
                Free time
              </Button>
            </div>
          </div>
          <div className="glass rounded-2xl bg-void/40 p-4">
            <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
              <Clock className="h-3 w-3" /> Free
            </div>
            <ul className="space-y-3">
              {freeTime.map((f) => (
                <li key={f.label}>
                  <div className="text-[13px] text-ink">{f.label}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {f.windows.length === 0 ? (
                      <span className="font-mono text-[10.5px] text-faint">—</span>
                    ) : (
                      f.windows.slice(0, 3).map((w) => (
                        <span key={w.start} className="rounded-full border border-accent-soft bg-accent-soft px-2 py-0.5 font-mono text-[10.5px] text-accent">
                          {tf(w.start)} – {tf(w.end)}
                        </span>
                      ))
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Latest sourced results */}
      <GlassPanel accent={ACCENT}>
        <SectionHeader
          title="Discoveries"
          eyebrow={latest?.art.title}
          action={latest ? latest.art.source === "parallel" ? <Badge tone="ok">Live web</Badge> : <ModeBadge mode="sample" /> : undefined}
        />
        {latest ? (
          <div className="grid gap-3 md:grid-cols-2">
            {latest.art.items.map((it, i) => (
              <ResultCard key={i} item={it} live={latest.art.source === "parallel"} />
            ))}
          </div>
        ) : (
          <EmptyState icon={Compass} title="No searches yet" />
        )}
      </GlassPanel>

      {/* Featured + samples */}
      <section>
        <SectionHeader title="For you" action={<ModeBadge mode="sample" />} />
        <motion.article
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="group relative mb-4 overflow-hidden rounded-[22px] border border-line"
          style={{ minHeight: 240 }}
          title={featured.blurb}
        >
          <Cover kind={featured.kind} seed={1} className="absolute inset-0 transition-transform duration-700 group-hover:scale-[1.03]" />
          <div className="relative flex h-full min-h-[240px] flex-col justify-end bg-[linear-gradient(180deg,transparent,rgb(5_8_22/0.85))] p-6">
            <Badge tone="accent" className="mb-3 w-fit">
              Featured · {featured.kind}
            </Badge>
            <h3 className="font-display text-3xl font-medium tracking-tight text-ink">{featured.title}</h3>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-mute">
              <span>{featured.when}</span>
              <span>{featured.area}</span>
              <span>{featured.priceHint}</span>
            </div>
          </div>
        </motion.article>
        <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {rest.map((d, i) => (
            <motion.article
              key={d.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass glass-rim glass-interactive group overflow-hidden rounded-[20px]"
              title={d.blurb}
            >
              <Cover kind={d.kind} seed={i + 2} className="h-28 transition-transform duration-700 group-hover:scale-105" />
              <div className="p-4">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">{d.kind}</span>
                  <span className="ml-auto font-mono text-[10px] text-faint">{d.priceHint}</span>
                </div>
                <h3 className="mt-1 text-[15px] font-medium text-ink">{d.title}</h3>
                <div className="mt-2.5 flex items-center gap-2 font-mono text-[10.5px] text-faint">
                  <MapPin className="h-3 w-3" /> {d.area} · {d.when}
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </section>

      <PreferencesPanel />
    </AgentWorkspace>
  );
}

function ResultCard({ item, live }: { item: EventOption; live: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-white/[0.015] p-4">
      {item.url ? (
        <a href={item.url} target="_blank" rel="noreferrer" className="group inline-flex items-start gap-1 text-sm font-medium text-ink hover:text-accent">
          {item.title} <ExternalLink className="mt-0.5 h-3 w-3 opacity-60 group-hover:opacity-100" />
        </a>
      ) : (
        <div className="text-sm font-medium text-ink">{item.title}</div>
      )}
      <div className="mt-1 flex flex-wrap gap-x-3 font-mono text-[10.5px] text-faint">
        {item.when && <span>{item.when}</span>}
        {item.venue && <span>{item.venue}</span>}
      </div>
      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-mute" title={item.summary}>
        {item.summary}
      </p>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {live && (item.dateVerified ? <Badge tone="ok">Date verified</Badge> : <Badge tone="warn">Date unconfirmed</Badge>)}
        {item.fitsSchedule === true && <Badge tone="cyan">Fits</Badge>}
        {item.fitsSchedule === false && <Badge tone="warn">Conflict</Badge>}
      </div>
    </div>
  );
}

function PreferencesPanel() {
  const profile = useClon((s) => s.profile);
  const update = useClon((s) => s.updateProfile);
  const [city, setCity] = useState(profile.city);
  const [interest, setInterest] = useState("");

  return (
    <GlassPanel accent={ACCENT}>
      <SectionHeader title="Preferences" />
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (city.trim()) update({ city: city.trim() });
            }}
          >
            <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-faint">City</div>
            <div className="flex gap-2">
              <input className="field" value={city} onChange={(e) => setCity(e.target.value)} aria-label="City" />
              <Button type="submit" variant="outline" disabled={city.trim() === profile.city}>
                Save
              </Button>
            </div>
          </form>
          <div className="mb-1.5 mt-5 font-mono text-[10px] uppercase tracking-[0.18em] text-faint">Budget</div>
          <Segmented<UserProfile["budget"]>
            label="Budget"
            value={profile.budget}
            onChange={(v) => update({ budget: v })}
            options={[
              { value: "$", label: "$" },
              { value: "$$", label: "$$" },
              { value: "$$$", label: "$$$" },
            ]}
          />
        </div>
        <div>
          <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-faint">Interests</div>
          <div className="flex flex-wrap gap-1.5">
            {profile.interests.map((i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-full border border-accent-soft bg-accent-soft py-1 pl-2.5 pr-1.5 text-xs text-ink">
                {i}
                <button
                  onClick={() => update({ interests: profile.interests.filter((x) => x !== i) })}
                  className="rounded-full p-0.5 text-mute hover:text-ink"
                  aria-label={`Remove ${i}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const v = interest.trim();
              if (v && !profile.interests.includes(v)) update({ interests: [...profile.interests, v].slice(0, 12) });
              setInterest("");
            }}
          >
            <input className="field" placeholder="Add…" value={interest} onChange={(e) => setInterest(e.target.value)} aria-label="New interest" />
            <Button type="submit" variant="outline" size="icon" aria-label="Add interest" disabled={!interest.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </GlassPanel>
  );
}
