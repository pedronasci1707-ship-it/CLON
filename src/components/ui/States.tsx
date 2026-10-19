import { TriangleAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  // `body` is kept as a hover hint: empty states stay one icon and a few words.
  return (
    <div title={body} className={cn("flex flex-col items-center justify-center gap-2.5 px-6 py-8 text-center", className)}>
      <span className="grid h-10 w-10 place-items-center rounded-full border border-line bg-white/[0.02] text-faint">
        <Icon className="h-4 w-4" strokeWidth={1.6} />
      </span>
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">{title}</div>
      {action}
    </div>
  );
}

export function LoadingState({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2.5", className)} role="status" aria-label="Loading">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton h-9 rounded-xl" style={{ width: `${100 - i * 9}%` }} />
      ))}
    </div>
  );
}

export function ErrorState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-card border border-danger/25 bg-danger/[0.06] p-4" role="alert">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-danger" strokeWidth={1.8} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-ink">{title}</div>
        {body && <p className="mt-1 break-words text-xs leading-relaxed text-mute">{body}</p>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}
