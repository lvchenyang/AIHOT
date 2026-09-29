// The site's wordmark from industry/brand and a small ring mark used as the loader.
import { SITE } from "@aihot/industry/site";
import icon from "@aihot/industry/brand/logo.svg?url&no-inline";
import wordmark from "@aihot/industry/brand/wordmark.png?url&no-inline";

export function Wordmark({ size = 22, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex max-w-full items-center ${className}`} style={{ gap: size / 4 }} role="img" aria-label={`${SITE.name}，${SITE.tagline}`}>
      <img src={icon} alt="" width={size * 1.5} height={size * 1.5} className="shrink-0" />
      <span className="min-w-0" aria-hidden="true">
        <img src={wordmark} alt="" width={size * 4.25} height={size * 4.25 / 3} className="block max-w-full object-contain dark:brightness-0 dark:invert" />
        <span className="block whitespace-nowrap font-normal tracking-[0.04em] text-ink-3" style={{ fontSize: size * 0.4, lineHeight: 1.2, paddingLeft: size / 3 }}>{SITE.tagline}</span>
      </span>
    </span>
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
