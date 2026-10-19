import { cn } from "@/lib/utils";
import type { HoloState } from "./HologramScene";

const BUST_PATH =
  "M200 58C246 58 273 94 273 146C273 176 266 201 253 223C244 239 233 251 223 257L223 284C223 292 229 298 239 302C281 316 331 330 353 352C369 368 375 394 377 422L23 422C25 394 31 368 47 352C69 330 119 316 161 302C171 298 177 292 177 284L177 257C167 251 156 239 147 223C134 201 127 176 127 146C127 94 154 58 200 58Z";

/** Pure SVG/CSS hologram — shown while WebGL loads and on devices without WebGL. */
export function HologramFallback({ state, className }: { state: HoloState; className?: string }) {
  const active = state !== "idle";
  return (
    <div className={cn("pointer-events-none absolute inset-0 grid place-items-center", className)} aria-hidden>
      <svg viewBox="0 0 400 480" className="h-[88%] w-auto overflow-visible">
        <defs>
          <linearGradient id="fb-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#5be7f5" stopOpacity="0.55" />
            <stop offset="0.6" stopColor="#7aa8ff" stopOpacity="0.28" />
            <stop offset="1" stopColor="#9879ff" stopOpacity="0.05" />
          </linearGradient>
          <pattern id="fb-lines" width="4" height="5" patternUnits="userSpaceOnUse">
            <rect width="4" height="1.2" fill="#9ff3fb" fillOpacity="0.55" />
          </pattern>
          <radialGradient id="fb-core">
            <stop offset="0" stopColor="#e9fbff" />
            <stop offset="0.35" stopColor="#5be7f5" stopOpacity="0.6" />
            <stop offset="1" stopColor="#9879ff" stopOpacity="0" />
          </radialGradient>
          <filter id="fb-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <clipPath id="fb-clip">
            <path d={BUST_PATH} />
          </clipPath>
        </defs>

        {/* projector base */}
        <g opacity="0.8">
          <ellipse cx="200" cy="440" rx="170" ry="22" fill="none" stroke="#5be7f5" strokeOpacity="0.25" />
          <ellipse cx="200" cy="440" rx="120" ry="15" fill="none" stroke="#9879ff" strokeOpacity="0.35" strokeDasharray="3 6" />
          <ellipse cx="200" cy="440" rx="70" ry="9" fill="#5be7f5" fillOpacity="0.12" />
          <path d="M130 440 L60 120 L340 120 L270 440 Z" fill="url(#fb-body)" opacity="0.06" />
        </g>

        <g filter="url(#fb-glow)" className="origin-center animate-float">
          <path d={BUST_PATH} fill="url(#fb-body)" opacity="0.35" />
          <path d={BUST_PATH} fill="url(#fb-lines)" opacity="0.5" />
          <path d={BUST_PATH} fill="none" stroke="#9ff3fb" strokeOpacity="0.7" strokeWidth="1.2" />
          <g clipPath="url(#fb-clip)">
            <rect x="0" y="0" width="400" height="40" fill="#e9fbff" opacity="0.35" className="animate-scan" />
          </g>
          <circle cx="200" cy="150" r={active ? 34 : 26} fill="url(#fb-core)" className="animate-pulse-soft" />
        </g>

        {/* orbital rings */}
        <g style={{ transformOrigin: "200px 170px" }} className="animate-spin-slow">
          <ellipse cx="200" cy="170" rx="165" ry="38" fill="none" stroke="#5be7f5" strokeOpacity={active ? 0.55 : 0.3} strokeDasharray="2 9" />
        </g>
        <ellipse cx="200" cy="300" rx="185" ry="34" fill="none" stroke="#9879ff" strokeOpacity="0.28" strokeDasharray="1 7" />
      </svg>
    </div>
  );
}
