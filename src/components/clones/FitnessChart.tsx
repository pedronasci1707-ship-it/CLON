"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useState } from "react";
import { cn } from "@/lib/utils";

// Two categorical series, validated with the dataviz palette checker against
// the dark chart surface (#0e1527): lightness band, chroma, CVD and contrast all pass.
export const SERIES = {
  demo: { label: "Demo data", color: "#8f7cf0" },
  manual: { label: "Your logs", color: "#78a125" },
} as const;

export interface DayDatum {
  date: string;
  label: string;
  demo: number;
  manual: number;
}

interface ShapeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  payload?: DayDatum;
  dataKey?: string;
}

/** Rounds only the top of the stack, keeping a 2px surface gap between segments. */
function Segment(props: ShapeProps) {
  const { x = 0, y = 0, width = 0, height = 0, fill, payload, dataKey } = props;
  if (!height || height <= 0) return null;
  const isTop = dataKey === "manual" || !payload?.manual;
  const r = isTop ? Math.min(4, width / 2, height) : 0;
  const h = Math.max(0, height - (dataKey === "demo" && payload?.manual ? 2 : 0));
  const path = r
    ? `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + h} Z`
    : `M${x},${y + h} V${y} H${x + width} V${y + h} Z`;
  return <path d={path} fill={fill} />;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: DayDatum }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl border border-line-strong bg-panel/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <div className="mb-1 font-medium text-ink">{d.date}</div>
      {(["manual", "demo"] as const).map((k) => (
        <div key={k} className="flex items-center gap-2 text-mute">
          <span className="h-2 w-2 rounded-sm" style={{ background: SERIES[k].color }} />
          {SERIES[k].label}
          <span className="ml-auto pl-4 font-mono text-soft">{d[k]} min</span>
        </div>
      ))}
      <div className="mt-1 flex border-t border-line pt-1 text-mute">
        Total <span className="ml-auto font-mono text-ink">{d.demo + d.manual} min</span>
      </div>
    </div>
  );
}

export function FitnessChart({ data, showDemo }: { data: DayDatum[]; showDemo: boolean }) {
  const [table, setTable] = useState(false);
  const keys = showDemo ? (["demo", "manual"] as const) : (["manual"] as const);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3 text-xs text-mute" aria-label="Legend">
          {keys.map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES[k].color }} />
              {SERIES[k].label}
            </span>
          ))}
        </div>
        <button onClick={() => setTable((t) => !t)} className="ml-auto font-mono text-[10px] uppercase tracking-[0.14em] text-faint hover:text-mute">
          {table ? "Show chart" : "View as table"}
        </button>
      </div>

      {table ? (
        <div className="max-h-[240px] overflow-y-auto rounded-xl border border-line">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-panel text-left font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
              <tr>
                <th className="px-3 py-2 font-normal">Day</th>
                {keys.map((k) => (
                  <th key={k} className="px-3 py-2 text-right font-normal">
                    {SERIES[k].label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.date} className="border-t border-line/60 text-soft">
                  <td className="px-3 py-1.5">{d.date}</td>
                  {keys.map((k) => (
                    <td key={k} className="px-3 py-1.5 text-right font-mono">
                      {d[k]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={cn("h-[240px] w-full")} role="img" aria-label="Active minutes per day over the last 14 days">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -12 }} barCategoryGap="22%">
              <CartesianGrid vertical={false} stroke="rgb(133 147 179 / 0.09)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#5a6684", fontSize: 10 }} interval={0} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: "#5a6684", fontSize: 10 }} width={40} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgb(255 255 255 / 0.035)" }} />
              {showDemo && (
                <Bar dataKey="demo" stackId="m" fill={SERIES.demo.color} shape={<Segment dataKey="demo" />} isAnimationActive animationDuration={700} />
              )}
              <Bar dataKey="manual" stackId="m" fill={SERIES.manual.color} shape={<Segment dataKey="manual" />} isAnimationActive animationDuration={700} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
