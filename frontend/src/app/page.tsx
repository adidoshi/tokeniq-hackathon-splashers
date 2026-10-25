import { ClientOnly } from "@/components/common/client-only";
import { DecisionLog } from "@/features/desk/components/decision-log";
import { DeskChart } from "@/features/desk/components/desk-chart";
import { EntryGate } from "@/features/desk/components/entry-gate";
import { KpiStrip } from "@/features/desk/components/kpi-strip";
import { RiskPanel } from "@/features/desk/components/risk-panel";
import { TradesTable } from "@/features/desk/components/trades-table";

/** Live Desk workstation: streaming KPI strip, real-time chart, trade blotter, and risk/decision sidebars. */
export default function LiveDeskPage() {
  return (
    <ClientOnly>
      <div className="flex flex-col gap-3.5">
        <KpiStrip />
        <div className="flex flex-wrap items-start gap-3.5">
          <div className="flex min-w-0 flex-[999_1_640px] flex-col gap-3.5">
            <DeskChart />
            <TradesTable />
          </div>
          <aside className="flex min-w-0 flex-[1_1_340px] flex-col gap-3.5">
            <EntryGate />
            <DecisionLog />
            <RiskPanel />
          </aside>
        </div>
      </div>
    </ClientOnly>
  );
}
