import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "accent" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variants: Record<Variant, string> = {
  primary:
    "text-void font-medium bg-[linear-gradient(110deg,#7cf0fa,#5be7f5_35%,#a08cff)] shadow-[0_8px_30px_-8px_rgb(91_231_245/0.55)] hover:shadow-[0_10px_38px_-6px_rgb(91_231_245/0.7)] hover:brightness-110",
  accent:
    "text-ink border border-accent-soft bg-accent-soft hover:brightness-125 hover:shadow-[0_0_24px_-6px_var(--accent)]",
  ghost: "text-soft hover:text-ink hover:bg-white/[0.05]",
  outline: "text-soft border border-line hover:border-line-strong hover:text-ink hover:bg-white/[0.03]",
  danger: "text-danger border border-danger/30 bg-danger/10 hover:bg-danger/15",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-[10px]",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-5 text-sm gap-2 rounded-2xl",
  icon: "h-9 w-9 rounded-xl",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "outline", size = "md", className, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-all duration-300 ease-out disabled:pointer-events-none disabled:opacity-40",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    />
  );
});
