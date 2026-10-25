import { cn } from "@/lib/utils";

/** Splashers wordmark: a splash drop mark in the brand gradient + text. No official logo yet, so this is the placeholder identity. */
export function SplashersMark({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden="true">
        <defs>
          <linearGradient id="splash-g" x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
            <stop stopColor="#22D3EE" />
            <stop offset="1" stopColor="#7C8BFF" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="9" fill="url(#splash-g)" />
        <path d="M16 5.5c3.6 4.6 6.6 7.9 6.6 11.6a6.6 6.6 0 0 1-13.2 0C9.4 13.4 12.4 10.1 16 5.5Z" fill="#fff" fillOpacity=".95" />
        <path d="M12.6 17.4a3.4 3.4 0 0 0 3 3.3" stroke="#7C8BFF" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      </svg>
      {!compact && (
        <span className="font-heading text-base leading-none font-extrabold tracking-tight text-heading">
          Splashers
        </span>
      )}
    </span>
  );
}
