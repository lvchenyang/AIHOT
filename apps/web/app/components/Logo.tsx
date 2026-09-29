// The site's wordmark from industry/brand and a small ring mark used as the loader.
import { SITE } from "@aihot/industry/site";
import wordmark from "@aihot/industry/brand/wordmark.svg?url&no-inline";

export function Wordmark({ size = 22, className = "" }: { size?: number; className?: string }) {
  const width = Math.max(144, size * 6);
  return (
    <svg viewBox="0 0 258 84" width={width} height={width * 84 / 258} className={`block h-auto max-w-full ${className}`} role="img" aria-label={`${SITE.name}，${SITE.tagline}`}>
      <use href={`${wordmark}#icon`} />
      <use href={`${wordmark}#ink`} className="fill-ink" />
      <use href={`${wordmark}#accent`} className="fill-accent" />
      <use href={`${wordmark}#tagline`} className="fill-ink-3" />
    </svg>
  );
}

/** A ring with a dot; spinning, it is the loader. */
export function RingMark({ className = "", spinning = false }: { className?: string; spinning?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <g style={spinning ? { transformOrigin: "12px 12px", animation: "spin-slow 1.1s linear infinite" } : undefined}>
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeDasharray="42 15" />
      </g>
      <circle cx="12" cy="12" r="2.6" fill="currentColor" />
    </svg>
  );
}
