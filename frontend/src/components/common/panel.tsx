import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface PanelProps {
  title?: string;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
}

/** Institutional bordered card section: clean hairline border, refined header, compact density. */
export function Panel({ title, aside, className, children, ...rest }: PanelProps) {
  return (
    <section
      aria-label={rest["aria-label"] ?? title}
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-3.5 sm:p-4",
        className
      )}
    >
      {(title || aside) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2.5">
          {title && (
            <h2 className="font-heading text-xs font-semibold tracking-wider text-heading uppercase">
              {title}
            </h2>
          )}
          {aside && <div className="text-[11px] text-muted-foreground">{aside}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
