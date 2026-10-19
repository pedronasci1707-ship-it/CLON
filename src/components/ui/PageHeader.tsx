export function PageHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-8 flex items-center gap-4">
      <h1 className="font-display text-[30px] font-medium tracking-tight text-ink sm:text-[36px]">
        <span className="text-gradient">{title}</span>
      </h1>
      <span className="hidden h-px flex-1 bg-[linear-gradient(90deg,var(--color-line-strong),transparent)] sm:block" aria-hidden />
      {action && <div className="ml-auto flex shrink-0 items-center gap-2 sm:ml-0">{action}</div>}
    </div>
  );
}
