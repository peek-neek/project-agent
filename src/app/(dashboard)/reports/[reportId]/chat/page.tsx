import type { Metadata } from "next";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { ChatSkeleton } from "@/components/globals/chat/chat-skeleton";
import { PropertyChat } from "@/components/globals/chat/property-chat";
import { QueryBoundary } from "@/components/globals/query-boundary";
import { TravelModeProvider } from "@/components/globals/travel-mode";
import { parseTravelMode, TRAVEL_MODE_COOKIE } from "@/lib/travel";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata: Metadata = {
  title: "Property chat",
  robots: { index: false, follow: false },
};

export default function ChatPage({
  params,
}: PageProps<"/reports/[reportId]/chat">) {
  return (
    <div className="flex-1">
      <QueryBoundary
        fallback={<ChatSkeleton />}
        errorTitle="We couldn't load this chat"
      >
        <ChatPrefetch params={params} />
      </QueryBoundary>
    </div>
  );
}

/** Streams the report and saved conversation to the client (no waterfall). */
async function ChatPrefetch({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = await params;
  await connection();
  prefetch(trpc.report.byId.queryOptions({ id: reportId }));
  prefetch(trpc.report.chatThread.queryOptions({ id: reportId }));
  const travelMode = parseTravelMode(
    (await cookies()).get(TRAVEL_MODE_COOKIE)?.value,
  );
  return (
    <HydrateClient>
      <TravelModeProvider mode={travelMode}>
        <PropertyChat reportId={reportId} />
      </TravelModeProvider>
    </HydrateClient>
  );
}
