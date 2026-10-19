"use client";

import { useEffect, useState, type RefObject } from "react";
import { CLONES } from "@/lib/clones";
import { useClon } from "@/lib/store";
import type { SpecialistId } from "@/lib/types";

interface Line {
  id: SpecialistId;
  d: string;
  end: [number, number];
  start: [number, number];
}

/**
 * Neural links between the Master hologram and each specialist card.
 * Links light up and pulse faster while that clone is working.
 */
export function ConnectionLines({
  container,
  core,
  cards,
}: {
  container: RefObject<HTMLElement | null>;
  core: RefObject<HTMLElement | null>;
  cards: RefObject<Partial<Record<SpecialistId, HTMLElement | null>>>;
}) {
  const [lines, setLines] = useState<Line[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const running = useClon((s) => s.running);

  useEffect(() => {
    const compute = () => {
      const box = container.current?.getBoundingClientRect();
      const coreBox = core.current?.getBoundingClientRect();
      if (!box || !coreBox || window.innerWidth < 1280) {
        setLines([]);
        return;
      }
      setSize({ w: box.width, h: box.height });
      const cx = coreBox.left + coreBox.width / 2 - box.left;
      const cy = coreBox.top + coreBox.height * 0.46 - box.top;
      const radius = Math.min(coreBox.width, coreBox.height) * 0.3;
      const next: Line[] = [];
      const map = cards.current;
      (Object.keys(map) as SpecialistId[]).forEach((id) => {
        const el = map[id];
        if (!el) return;
        const r = el.getBoundingClientRect();
        const left = r.left + r.width / 2 < coreBox.left + coreBox.width / 2;
        const ex = (left ? r.right : r.left) - box.left;
        const ey = r.top + r.height / 2 - box.top;
        const angle = Math.atan2(ey - cy, ex - cx);
        const sx = cx + Math.cos(angle) * radius;
        const sy = cy + Math.sin(angle) * radius * 0.9;
        const mx = (sx + ex) / 2;
        next.push({
          id,
          start: [sx, sy],
          end: [ex, ey],
          d: `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ey}, ${ex} ${ey}`,
        });
      });
      setLines(next);
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (container.current) ro.observe(container.current);
    window.addEventListener("resize", compute);
    const t = setTimeout(compute, 400);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", compute);
      clearTimeout(t);
    };
  }, [container, core, cards]);

  if (!lines.length) return null;

  return (
    <svg className="pointer-events-none absolute inset-0 z-0 hidden xl:block" width={size.w} height={size.h} aria-hidden>
      <defs>
        {lines.map((l) => (
          <linearGradient
            key={l.id}
            id={`link-${l.id}`}
            gradientUnits="userSpaceOnUse"
            x1={l.start[0]}
            y1={l.start[1]}
            x2={l.end[0]}
            y2={l.end[1]}
          >
            <stop offset="0" stopColor="#5be7f5" stopOpacity="0.05" />
            <stop offset="1" stopColor={CLONES[l.id].accent} stopOpacity="0.7" />
          </linearGradient>
        ))}
      </defs>
      {lines.map((l) => {
        const active = !!running?.activeClones.includes(l.id);
        const accent = CLONES[l.id].accent;
        return (
          <g key={l.id}>
            <path d={l.d} fill="none" stroke={`url(#link-${l.id})`} strokeWidth={active ? 1.4 : 1} opacity={active ? 1 : 0.55} />
            <path
              d={l.d}
              fill="none"
              stroke={accent}
              strokeWidth={active ? 2 : 1.2}
              strokeLinecap="round"
              strokeDasharray={active ? "2 10" : "1.5 22"}
              opacity={active ? 0.95 : 0.45}
              className="animate-dash"
              style={{ animationDuration: active ? "0.6s" : "2.6s", filter: active ? `drop-shadow(0 0 4px ${accent})` : undefined }}
            />
            <circle cx={l.end[0]} cy={l.end[1]} r={active ? 3.5 : 2.5} fill={accent} opacity={active ? 1 : 0.7}>
              {active && <animate attributeName="r" values="3;5;3" dur="1s" repeatCount="indefinite" />}
            </circle>
            <circle cx={l.start[0]} cy={l.start[1]} r="1.8" fill="#9ff3fb" opacity="0.8" />
          </g>
        );
      })}
    </svg>
  );
}
