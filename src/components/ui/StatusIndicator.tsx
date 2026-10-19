import { cn } from "@/lib/utils";

export type AgentState = "idle" | "working" | "attention" | "disabled" | "error";

const styles: Record<AgentState, { dot: string; label: string; text: string }> = {
  idle: { dot: "bg-ok", label: "Ready", text: "text-mute" },
  working: { dot: "bg-cyan", label: "Working", text: "text-cyan" },
  attention: { dot: "bg-warn", label: "Needs you", text: "text-warn" },
  disabled: { dot: "bg-faint", label: "Paused", text: "text-faint" },
  error: { dot: "bg-danger", label: "Error", text: "text-danger" },
};

export function StatusIndicator({
  state,
  label,
  className,
}: {
  state: AgentState;
  label?: string;
  className?: string;
}) {
  const s = styles[state];
  const animated = state === "working" || state === "attention";
  return (
    <span className={cn("inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em]", s.text, className)}>
      <span className="relative flex h-2 w-2">
        {animated && <span className={cn("absolute inset-0 animate-ping rounded-full opacity-60", s.dot)} />}
        <span className={cn("relative h-2 w-2 rounded-full", s.dot)} />
      </span>
      {label ?? s.label}
    </span>
  );
}
