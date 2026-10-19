"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  // Unique per instance: a gradient defined inside a hidden (display:none) copy can't be referenced.
  const id = `clon-mark-${useId().replace(/:/g, "")}`;
  return (
    <svg viewBox="0 0 32 32" className={cn("h-8 w-8", className)} fill="none" aria-hidden>
      <defs>
        <linearGradient id={id} x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8ff4fb" />
          <stop offset="1" stopColor="#9879ff" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="14.5" stroke={`url(#${id})`} strokeOpacity="0.25" strokeDasharray="1.5 3" />
      <path d="M24.2 9.8A10 10 0 1 0 24.2 22.2" stroke={`url(#${id})`} strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="16" cy="16" r="3.1" fill={`url(#${id})`} />
      <circle cx="26" cy="16" r="1.7" fill="#5be7f5" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-display text-[17px] font-semibold tracking-[0.34em] text-ink", className)}>CLON</span>
  );
}
