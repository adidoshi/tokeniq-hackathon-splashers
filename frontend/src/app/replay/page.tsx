import type { Metadata } from "next";

import { ClientOnly } from "@/components/common/client-only";
import { ReplayView } from "@/features/replay/replay-view";

export const metadata: Metadata = { title: "Session Replay · TokenIQ" };

export default function ReplayPage() {
  return (
    <ClientOnly>
      <ReplayView />
    </ClientOnly>
  );
}
