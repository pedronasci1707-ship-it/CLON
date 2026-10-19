"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowUp, CornerDownLeft, LoaderCircle, Sparkles } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { runCommand } from "@/lib/agent-client";
import { CLONES } from "@/lib/clones";
import { useClon } from "@/lib/store";
import type { CloneId } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CommandBarProps {
  clone: CloneId;
  size?: "lg" | "md";
  suggestions?: string[];
  onSubmitted?: () => void;
  autoFocus?: boolean;
  /** Bind ⌘K / Ctrl+K to focus this input. */
  hotkey?: boolean;
  /** Hide the suggestion chips (e.g. once a conversation exists). */
  hideChips?: boolean;
  className?: string;
}

export function CommandBar({ clone, size = "md", suggestions, onSubmitted, autoFocus, hotkey, hideChips, className }: CommandBarProps) {
  const def = CLONES[clone];
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [hint, setHint] = useState(0);
  const running = useClon((s) => s.running);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chips = suggestions ?? def.suggestions;

  useEffect(() => {
    if (focused || value) return;
    const t = setInterval(() => setHint((h) => (h + 1) % chips.length), 4200);
    return () => clearInterval(t);
  }, [focused, value, chips.length]);

  useEffect(() => {
    if (!hotkey) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hotkey]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
    el.style.overflowY = el.scrollHeight > 140 ? "auto" : "hidden";
  }, [value]);

  const submit = (text: string) => {
    const cmd = text.trim();
    if (!cmd || running) return;
    setValue("");
    onSubmitted?.();
    void runCommand(clone, cmd);
  };

  const lg = size === "lg";
  const busy = !!running;

  return (
    <div className={cn("w-full", className)} style={{ "--accent": def.accent } as CSSProperties}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(value);
        }}
        className={cn(
          "glass relative flex items-end gap-3 overflow-hidden transition-all duration-500",
          lg ? "rounded-[22px] p-2.5 pl-5" : "rounded-2xl p-2 pl-4",
          focused && "border-accent-soft shadow-[0_0_0_4px_color-mix(in_oklab,var(--accent)_10%,transparent),0_24px_60px_-28px_var(--accent)]",
        )}
      >
        {busy && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px overflow-hidden">
            <div className="h-full w-full animate-[shimmer_1.2s_linear_infinite] bg-[linear-gradient(90deg,transparent,var(--accent),transparent)] bg-[length:50%_100%] bg-no-repeat" />
          </div>
        )}
        <Sparkles className={cn("mb-3 shrink-0 text-accent", lg ? "h-5 w-5" : "h-4 w-4")} strokeWidth={1.6} />
        <div className="relative min-w-0 flex-1 self-center">
          <textarea
            ref={inputRef}
            rows={1}
            value={value}
            autoFocus={autoFocus}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(value);
              }
            }}
            aria-label={`Command for ${def.name}`}
            className={cn(
              "block w-full resize-none overflow-hidden bg-transparent py-2 text-ink outline-none",
              lg ? "text-[15px] leading-6" : "text-sm leading-6",
            )}
          />
          {!value && (
            <div className={cn("pointer-events-none absolute inset-0 flex items-center overflow-hidden text-mute/75", lg ? "text-[15px]" : "text-sm")}>
              <AnimatePresence mode="wait">
                <motion.span
                  key={hint}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.35 }}
                  className="truncate"
                >
                  {busy ? `${running?.label ?? "Working"}…` : chips[hint]}
                </motion.span>
              </AnimatePresence>
            </div>
          )}
        </div>
        {lg && !value && !busy && (
          <kbd className="mb-2.5 hidden shrink-0 items-center gap-1 rounded-md border border-line px-1.5 py-0.5 font-mono text-[10px] text-faint sm:flex">
            Ctrl K
          </kbd>
        )}
        <button
          type="submit"
          disabled={!value.trim() || busy}
          aria-label="Run command"
          className={cn(
            "grid shrink-0 place-items-center rounded-xl text-void transition-all duration-300 disabled:opacity-35",
            lg ? "h-11 w-11" : "h-9 w-9",
            "bg-[linear-gradient(135deg,#8ff4fb,#5be7f5_40%,#a08cff)] shadow-[0_6px_24px_-6px_rgb(91_231_245/0.6)] enabled:hover:brightness-110",
          )}
        >
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" strokeWidth={2.2} />}
        </button>
      </form>

      <div className={cn("mt-3 flex flex-wrap gap-2", lg && "justify-center", hideChips && "hidden")}>
        {chips.slice(0, lg ? 3 : 3).map((s) => (
          <button
            key={s}
            onClick={() => submit(s)}
            disabled={busy}
            className="group inline-flex max-w-full items-center gap-1.5 rounded-full border border-line bg-white/[0.02] px-3 py-1.5 text-left text-xs text-mute transition-all hover:border-accent-soft hover:bg-accent-soft hover:text-ink disabled:opacity-40"
          >
            <CornerDownLeft className="h-3 w-3 shrink-0 text-faint transition-colors group-hover:text-accent" />
            <span className="truncate">{s.length > 64 ? `${s.slice(0, 62)}…` : s}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
