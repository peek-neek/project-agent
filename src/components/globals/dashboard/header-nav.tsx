import { Suspense } from "react";
import { ReportViewSwitch, ReportViewSwitchLive } from "./report-view-switch";

/** Header title outside a report. */
export function HeaderTitle() {
  return <span className="text-sm text-foreground/65">Property reports</span>;
}

/**
 * Report | Chat on report pages. The fallback is the same switch without
 * links (the id is only known per request), so it never flickers.
 */
export function ReportHeaderNav({ active }: { active: "report" | "chat" }) {
  return (
    <Suspense fallback={<ReportViewSwitch active={active} reportId={null} />}>
      <ReportViewSwitchLive active={active} />
    </Suspense>
  );
}
