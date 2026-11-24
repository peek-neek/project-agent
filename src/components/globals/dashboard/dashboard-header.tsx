import { Suspense } from "react";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { MarketScoreBadge } from "@/components/globals/report/market-score-badge";
import { TravelModeToggle } from "@/components/globals/travel-mode";
import { TopProgressBar } from "@/components/globals/top-progress";
import { ModeToggle } from "@/components/globals/mode-toggle";

export function DashboardHeader({ nav }: { nav: React.ReactNode }) {
  return (
    <header
      data-slot="dashboard-header"
      className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-foreground/10 bg-background/85 px-3 backdrop-blur-md sm:px-4 print:hidden"
    >
      <SidebarTrigger />
      <Separator
        orientation="vertical"
        className="mx-1 h-5 data-vertical:self-center"
      />
      {/* "Property reports", or Report | Chat on a report (the @nav slot). */}
      {nav}
      <div className="ml-auto flex items-center gap-3">
        {/* On a report: how easy the location makes it to sell or rent.
            Suspense: it reads the URL's reportId (useParams), which is only
            known at request time, so it can't be in the prerendered shell. */}
        <Suspense fallback={null}>
          <MarketScoreBadge />
        </Suspense>
        <Separator
          orientation="vertical"
          className="mx-1 h-5 data-vertical:self-center"
        />
        {/* Walk / cycle / car: switches every travel time in the app. */}
        <TravelModeToggle />
        {/* Light / dark / system. Phones: in the account menu instead (the
            header is full there). */}
        <ModeToggle className="hidden size-8 bg-card sm:inline-flex" />
      </div>
      {/* Loading bar along the bottom edge (pages, reports, chat). */}
      <Suspense fallback={null}>
        <TopProgressBar />
      </Suspense>
    </header>
  );
}
