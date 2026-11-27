"use client";

import {
  useQueryClient,
  useSuspenseQueries,
  useSuspenseQuery,
} from "@tanstack/react-query";
import type { UIMessage } from "ai";
import { GlobeIcon, PenLineIcon, ScaleIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { useState } from "react";
import {
  mintComparisonChatToken,
  newComparisonChat,
  startComparisonChat,
} from "@/components/globals/chat/actions";
import {
  ChatSession,
  type ChatSuggestion,
} from "@/components/globals/chat/property-chat";
import { useTRPC } from "@/trpc/client";
import { StickyNote } from "@/components/globals/report/sticky-note";
import { SideChip } from "./compare-shared";

/** One of each kind: comparing from the reports, beyond them, and writing. */
const SUGGESTIONS: ChatSuggestion[] = [
  {
    icon: ScaleIcon,
    question: "Compare the two homes in a table: what does each do better?",
  },
  {
    icon: GlobeIcon,
    question: "Which one is closer to a big grocery store, and by how much?",
  },
  {
    icon: PenLineIcon,
    question:
      "Write a short message to my buyers explaining how these two homes differ.",
  },
];

const streetOf = (full: string) => full.split(",")[0]!.trim();

/**
 * The chat about a comparison: one conversation covering Property A and
 * Property B only, on the comparison-chat agent.
 */
export function CompareChat({ comparisonId }: { comparisonId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: comparison } = useSuspenseQuery(
    trpc.comparison.byId.queryOptions({ id: comparisonId }),
  );
  if (!comparison) notFound();
  const [{ data: reportA }, { data: reportB }, { data: thread }] =
    useSuspenseQueries({
      queries: [
        trpc.report.byId.queryOptions({ id: comparison.reportAId }),
        trpc.report.byId.queryOptions({ id: comparison.reportBId }),
        trpc.comparison.chatThread.queryOptions({ id: comparisonId }),
      ],
    });
  const [starting, setStarting] = useState(false);
  if (!reportA || !reportB) notFound();

  // "New chat": a fresh thread (new chat id, new durable session).
  const startNewChat = async () => {
    setStarting(true);
    try {
      const chatId = await newComparisonChat(comparisonId);
      queryClient.setQueryData(
        trpc.comparison.chatThread.queryKey({ id: comparisonId }),
        { chatId, messages: [], session: null },
      );
    } finally {
      setStarting(false);
    }
  };

  const full = {
    a: reportA.property?.formattedAddress ?? reportA.inputAddress,
    b: reportB.property?.formattedAddress ?? reportB.inputAddress,
  };
  const street = { a: streetOf(full.a), b: streetOf(full.b) };

  return (
    <ChatSession
      key={thread.chatId}
      chatId={thread.chatId}
      // Saved by the agent as UI messages; tRPC's JSON typing loses that.
      initialMessages={thread.messages as unknown as UIMessage[]}
      session={thread.session}
      agent={{
        task: "comparison-chat",
        accessToken: ({ chatId }) => mintComparisonChatToken(chatId),
        startSession: ({ chatId, clientData }) =>
          startComparisonChat({ chatId, clientData }),
      }}
      context={
        <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
          {(["a", "b"] as const).map((side, i) => (
            <span key={side} className="contents">
              {i > 0 && <span className="shrink-0 text-foreground/40">vs</span>}
              <span
                className="flex min-w-0 items-center gap-1.5"
                title={full[side]}
              >
                <SideChip side={side} />
                <span className="truncate">{street[side]}</span>
                <StickyNote
                  report={side === "a" ? reportA : reportB}
                  street={street[side]}
                  size="sm"
                />
              </span>
            </span>
          ))}
        </span>
      }
      intro={{
        title: `Ask about ${street.a} and ${street.b}`,
        description:
          "Answers compare both reports side by side, with Google Maps and the web for anything else. This chat covers these two homes only. Times follow your walk / car setting.",
        suggestions: SUGGESTIONS,
      }}
      placeholder={`Ask about ${street.a} or ${street.b}…`}
      hint="Uses both reports, Google Maps and the web · check before sharing"
      onNewChat={startNewChat}
      startingNewChat={starting}
    />
  );
}
