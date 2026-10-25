import { cn } from "@/lib/utils";

/**
 * Official TokenIQ and Delta Exchange logos. Both files are white-on-transparent, so they sit on a dark chip
 * that works in light and dark themes. (delta-exchange-logo-white.svg is the original with currentColor -> white.)
 */
export function PartnerLogos({ className, size = "md" }: { className?: string; size?: "sm" | "md" }) {
  const h = size === "sm" ? "h-4" : "h-5";
  return (
    <span className={cn("inline-flex items-center gap-2.5 rounded-xl bg-[#0B1020] px-3 py-1.5 ring-1 ring-white/10", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logos/token-iq-logo.svg" alt="TokenIQ" className={cn(h, "w-auto")} />
      <span className="text-[10px] text-white/50" aria-hidden="true">×</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logos/delta-exchange-logo-white.svg" alt="Delta Exchange" className={cn(h, "w-auto")} />
    </span>
  );
}
