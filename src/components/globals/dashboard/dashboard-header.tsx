import { ClerkLoaded, ClerkLoading, UserButton } from "@clerk/nextjs";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { MarketScoreBadge } from "@/components/globals/report/market-score-badge";
import { TravelModeToggle } from "@/components/globals/travel-mode";

export function DashboardHeader() {
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
      <span className="text-sm text-foreground/65">Property reports</span>
      <div className="ml-auto flex items-center gap-3">
        {/* On a report: how hard the location makes it to sell or rent. */}
        <MarketScoreBadge />
        {/* Walk / cycle / car: switches every travel time in the app. */}
        <TravelModeToggle />
        {/* Client-only: the header is in the prerendered shell, where Clerk
            can't know the user, so rendering UserButton there causes a
            hydration mismatch. ClerkLoaded renders nothing until Clerk loads. */}
        <ClerkLoading>
          <Skeleton className="size-7" />
        </ClerkLoading>
        <ClerkLoaded>
          <UserButton />
        </ClerkLoaded>
      </div>
    </header>
  );
}
