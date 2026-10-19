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

export function SectionHeader({
  eyebrow,
  title,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.22em] text-faint">{eyebrow}</div>
        )}
        <h2 className="truncate font-display text-[15px] font-medium tracking-tight text-ink">{title}</h2>
      </div>
      {action}
    </div>
  );
}
