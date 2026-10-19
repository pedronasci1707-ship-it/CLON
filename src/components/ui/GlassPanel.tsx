import { forwardRef, type CSSProperties, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  accent?: string;
  interactive?: boolean;
  rim?: boolean;
  padded?: boolean;
}

export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(function GlassPanel(
  { accent, interactive, rim = true, padded = true, className, style, children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        "glass rounded-panel",
        rim && "glass-rim",
        interactive && "glass-interactive",
        padded && "p-5",
        className,
      )}
      style={{ ...(accent ? ({ "--accent": accent } as CSSProperties) : null), ...style }}
      {...rest}
    >
      {children}
    </div>
  );
});

/** HUD-style label: a lit dot and one or two words. Secondary context (eyebrow) is a tooltip, not copy. */
export function SectionHeader({
  eyebrow,
  title,
  count,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  count?: number;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex min-h-7 items-center justify-between gap-3", className)}>
      <h2 title={eyebrow} className="flex min-w-0 items-center gap-2.5 font-mono text-[10.5px] uppercase tracking-[0.24em] text-mute">
        <span className="h-1 w-1 shrink-0 rounded-full bg-accent shadow-[0_0_8px_var(--accent)]" aria-hidden />
        <span className="truncate">{title}</span>
        {!!count && <span className="text-accent">{count}</span>}
      </h2>
      {action}
    </div>
  );
}
