import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-7">
      <Link href="/" className="mb-5 inline-flex items-center gap-1.5 text-xs text-mute transition-colors hover:text-cyan">
        <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
      </Link>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-cyan">{eyebrow}</div>
          <h1 className="mt-1.5 font-display text-[28px] font-medium tracking-tight text-ink sm:text-[32px]">{title}</h1>
          {description && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mute">{description}</p>}
        </div>
        {action && <div className="sm:ml-auto">{action}</div>}
      </div>
    </div>
  );
}
