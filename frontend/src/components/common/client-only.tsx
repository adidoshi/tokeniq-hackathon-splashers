"use client";

import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { useHydrated } from "@/hooks/use-hydrated";

/**
 * Renders `fallback` on the server and during hydration, then the live widgets. The pages are all live
 * data, so this costs nothing and guarantees the first client render matches the server HTML.
 */
export function ClientOnly({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const hydrated = useHydrated();
  if (!hydrated) return fallback ?? <Skeleton className="h-[70vh] rounded-2xl" aria-label="Loading" />;
  return children;
}
