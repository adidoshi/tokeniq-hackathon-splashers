import type { Metadata } from "next";

import { ClientOnly } from "@/components/common/client-only";
import { BacktestView } from "@/features/backtest/components/backtest-view";

export const metadata: Metadata = { title: "Backtest Lab · Algo Trading Terminal for Delta Exchange India" };

export default function BacktestPage() {
  return (
    <ClientOnly>
      <BacktestView />
    </ClientOnly>
  );
}
