"use client";

import dynamic from "next/dynamic";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Component, useCallback, useEffect, useState, type ReactNode } from "react";
import { CLONES } from "@/lib/clones";
import { useClon } from "@/lib/store";
import { cn } from "@/lib/utils";
import { HologramFallback } from "./HologramFallback";
import type { HoloState } from "./HologramScene";

const HologramScene = dynamic(() => import("./HologramScene"), { ssr: false });

class SceneBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function detectWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

interface MasterHologramProps {
  className?: string;
  /** Lower particle density for secondary placements. */
  compact?: boolean;
  onActivate?: () => void;
  showLabel?: boolean;
}

export function MasterHologram({ className, compact = false, onActivate, showLabel = true }: MasterHologramProps) {
  const running = useClon((s) => s.running);
  const reducedMotion = useReducedMotion() ?? false;
  const [hover, setHover] = useState(false);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => setWebgl(detectWebGL()), []);
  const handleReady = useCallback(() => setReady(true), []);

  const state: HoloState = running ? "processing" : hover ? "hover" : "idle";
  const workingClone = running?.activeClones.find((c) => c !== "master") ?? running?.activeClones[0];

  const interactive = !!onActivate;

  return (
    <div
      className={cn("group relative select-none", interactive && "cursor-pointer", className)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (interactive && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onActivate?.();
        }
      }}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? "Open the Master Clone command center" : "Master Clone hologram"}
    >
      {/* Aura */}
      <div
        className={cn(
          "pointer-events-none absolute left-1/2 top-[44%] aspect-square w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-700",
          state === "processing" ? "opacity-100 scale-110" : state === "hover" ? "opacity-90 scale-105" : "opacity-70",
        )}
        style={{
          background:
            "radial-gradient(circle, rgb(91 231 245 / 0.16) 0%, rgb(152 121 255 / 0.10) 38%, transparent 68%)",
          filter: "blur(10px)",
        }}
      />

      <HologramFallback state={state} className={cn("transition-opacity duration-1000", ready ? "opacity-0" : "opacity-100")} />

      {webgl && (
        <div className={cn("absolute inset-0 transition-opacity duration-700", ready ? "opacity-100" : "opacity-0")}>
          <SceneBoundary onError={() => setWebgl(false)}>
            <HologramScene state={state} reducedMotion={reducedMotion} density={compact ? 0.6 : 1} onReady={handleReady} />
          </SceneBoundary>
        </div>
      )}

      {showLabel && (
        <AnimatePresence>
          {(hover || running) && (
            <motion.div
              initial={{ opacity: 0, y: 6, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: 6, filter: "blur(4px)" }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-none absolute left-1/2 top-[6%] -translate-x-1/2"
            >
              <div className="glass flex items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inset-0 animate-ping rounded-full bg-cyan opacity-70" />
                  <span className="relative h-1.5 w-1.5 rounded-full bg-cyan" />
                </span>
                {running ? (
                  <>
                    Working
                    {workingClone && workingClone !== "master" && (
                      <span style={{ color: CLONES[workingClone].accent }}>· {CLONES[workingClone].short}</span>
                    )}
                  </>
                ) : (
                  <>{interactive ? "Open Master" : "Ready"}</>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
