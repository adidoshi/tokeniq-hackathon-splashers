import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface StatTileProps {
  label: string;
  value?: ReactNode;
  sub?: ReactNode;
  /** "accent" = the bot's own highlight (lilac); use for at most one tile per row */
  tone?: "default" | "accent";
  valueClassName?: string;
  loading?: boolean;
  className?: string;
}

export function StatTile({ label, value, sub, tone = "default", valueClassName, loading, className }: StatTileProps) {
  const accent = tone === "accent";
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-[10px] border bg-card px-4 py-3.5",
        accent && "border-accent-line bg-accent-soft",
        className,
      )}
    >
      <span className={cn("eyebrow", accent && "text-primary")}>{label}</span>
      {loading ? (
        <Skeleton className="h-8 w-28" />
      ) : (
        <span className={cn("tabular font-mono text-2xl font-medium sm:text-[26px]", valueClassName)}>{value}</span>
      )}
      {sub && <span className={cn("text-xs text-muted-foreground", accent && "text-accent-text")}>{sub}</span>}
    </div>
  );
}
