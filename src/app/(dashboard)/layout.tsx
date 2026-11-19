import { DashboardHeader } from "@/components/globals/dashboard/dashboard-header";
import {
  DashboardSidebar,
  HistorySkeleton,
} from "@/components/globals/dashboard/dashboard-sidebar";
import { ReportHistoryPrefetch } from "@/components/globals/dashboard/report-history-prefetch";
import { QueryBoundary } from "@/components/globals/query-boundary";
import {
  PersistedSidebarProvider,
  SIDEBAR_STATE_SCRIPT,
} from "@/components/globals/dashboard/persisted-sidebar-provider";
import { InlineScript } from "@/components/globals/inline-script";
import { SidebarInset } from "@/components/ui/sidebar";

/** App shell for signed-in agents: report history on the left. */
export default function DashboardLayout({
  children,
  nav,
}: {
  children: React.ReactNode;
  /** Header navigation for the current page (the @nav slot). */
  nav: React.ReactNode;
}) {
  return (
    <PersistedSidebarProvider>
      <DashboardSidebar
        history={
          <QueryBoundary
            fallback={<HistorySkeleton />}
            errorTitle="Couldn't load your reports"
            variant="compact"
          >
            <ReportHistoryPrefetch />
          </QueryBoundary>
        }
      />
      {/* Must follow the sidebar: it corrects the sidebar's markup. */}
      <InlineScript html={SIDEBAR_STATE_SCRIPT} />
      <SidebarInset>
        <DashboardHeader nav={nav} />
        {children}
      </SidebarInset>
    </PersistedSidebarProvider>
  );
}
