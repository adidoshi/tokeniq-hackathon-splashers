"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

interface PriceFlashProps {
  value: number | null | undefined;
  format: (n: number) => string;
  className?: string;
}

/**
 * Shows a live number and blinks green when it ticks up, red when it ticks down.
 * The flash restarts on every change by remounting the span (key = tick counter).
 */
export function PriceFlash({ value, format, className }: PriceFlashProps) {
  const [prev, setPrev] = useState<number | null>(null);
  const [flash, setFlash] = useState<{ dir: "up" | "down" | null; n: number }>({ dir: null, n: 0 });

  // React's "adjust state while rendering" pattern: compare with the last value we saw
  if (value != null && value !== prev) {
    setPrev(value);
    if (prev != null) setFlash((f) => ({ dir: value > prev ? "up" : "down", n: f.n + 1 }));
  }

  return (
    <span
      key={flash.n}
      className={cn("tabular px-1", flash.dir === "up" && "flash-up", flash.dir === "down" && "flash-down", className)}
    >
      {value == null ? "-" : format(value)}
    </span>
  );
}
