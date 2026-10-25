import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface PanelProps {
  title?: string;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
}

/** The standard bordered section: optional heading row + content. */
export function Panel({ title, aside, className, children, ...rest }: PanelProps) {
  return (
    <section
      aria-label={rest["aria-label"] ?? title}
      className={cn("flex min-w-0 flex-col gap-3.5 rounded-2xl border bg-card p-4 shadow-2xs sm:p-5", className)}
    >
      {(title || aside) && (
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          {title && <h2 className="font-heading text-sm font-semibold tracking-tight">{title}</h2>}
          {aside && <div className="text-xs text-muted-foreground">{aside}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
