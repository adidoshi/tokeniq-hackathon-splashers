import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface StatTileProps {
  label: string;
  value?: ReactNode;
  sub?: ReactNode;
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
        "flex min-w-0 flex-col justify-between gap-1.5 rounded-lg border border-border bg-card p-3 sm:p-3.5 transition-colors",
        accent && "border-primary/30 bg-primary/5",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn("text-[10px] font-semibold tracking-wider uppercase text-muted-foreground", accent && "text-primary")}>
          {label}
        </span>
      </div>
      {loading ? (
        <Skeleton className="my-1 h-7 w-28 rounded" />
      ) : (
        <div className={cn("tabular font-mono text-xl font-semibold tracking-tight sm:text-[22px] text-foreground", valueClassName)}>
          {value}
        </div>
      )}
      {sub && <div className={cn("text-[11px] leading-tight text-muted-foreground", accent && "text-foreground/80")}>{sub}</div>}
    </div>
  );
}
