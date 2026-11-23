import type { Metadata } from "next";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { ChatSkeleton } from "@/components/globals/chat/chat-skeleton";
import { CompareChat } from "@/components/globals/compare/compare-chat";
import { QueryBoundary } from "@/components/globals/query-boundary";
import { TravelModeProvider } from "@/components/globals/travel-mode";
import { parseTravelMode, TRAVEL_MODE_COOKIE } from "@/lib/travel";
import { getQueryClient, HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata: Metadata = {
  title: "Comparison chat",
  robots: { index: false, follow: false },
};

export default function CompareChatPage({
  params,
}: PageProps<"/compare/[comparisonId]/chat">) {
  return (
    <div className="flex-1">
      <QueryBoundary
        fallback={<ChatSkeleton />}
        errorTitle="We couldn't load this chat"
      >
        <CompareChatPrefetch params={params} />
      </QueryBoundary>
    </div>
  );
}

/** Streams both reports and the saved conversation to the client. */
async function CompareChatPrefetch({
  params,
}: {
  params: Promise<{ comparisonId: string }>;
}) {
  const { comparisonId } = await params;
  await connection();
  const comparison = await getQueryClient().fetchQuery(
    trpc.comparison.byId.queryOptions({ id: comparisonId }),
  );
  if (comparison) {
    prefetch(trpc.report.byId.queryOptions({ id: comparison.reportAId }));
    prefetch(trpc.report.byId.queryOptions({ id: comparison.reportBId }));
    prefetch(trpc.comparison.chatThread.queryOptions({ id: comparisonId }));
  }
  const travelMode = parseTravelMode(
    (await cookies()).get(TRAVEL_MODE_COOKIE)?.value,
  );
  return (
    <HydrateClient>
      <TravelModeProvider mode={travelMode}>
        <CompareChat comparisonId={comparisonId} />
      </TravelModeProvider>
    </HydrateClient>
  );
}
