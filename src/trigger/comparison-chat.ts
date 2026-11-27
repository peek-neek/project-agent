import { chat } from "@trigger.dev/sdk/ai";
import { isStepCount } from "ai";
import { z } from "zod";
import { parseTravelMode } from "../lib/travel";
import { comparisonChatStorage } from "../server/ai/chat-storage";
import {
  type ComparedPair,
  comparisonInstructions,
  comparisonTools,
} from "../server/ai/comparison-chat";
import { chatModel, chatProviderOptions } from "../server/ai/property-chat";
import {
  comparisonIdOfChat,
  comparisonStore,
} from "../server/comparison-store";
import {
  chatRefusalMessage,
  getChatAllowance,
  recordChatMessage,
} from "../server/entitlements";
import { reportStore } from "../server/report-store";

/** The comparison a chat belongs to, with both full reports. Fresh every turn. */
async function chatComparison(chatId: string) {
  const comparison = await comparisonStore.findById(comparisonIdOfChat(chatId));
  if (!comparison) throw new Error("This chat's comparison no longer exists.");
  const [a, b] = await Promise.all([
    reportStore.findWithDetails(comparison.reportAId),
    reportStore.findWithDetails(comparison.reportBId),
  ]);
  if (!a || !b)
    throw new Error("A report in this comparison no longer exists.");
  return { comparison, pair: { a, b } satisfies ComparedPair };
}

/**
 * The comparison chat as a durable agent, like the property chat: one
 * long-lived run per conversation, history saved on the comparison. Answers
 * cover Property A and Property B only.
 */
export const comparisonChat = chat
  .withClientData({
    // The agent's walk / car choice, sent with every message.
    schema: z.object({
      travelMode: z.enum(["walk", "drive"]).optional(),
    }),
  })
  .agent({
    id: "comparison-chat",
    storage: comparisonChatStorage,
    // Each tool takes property "A" or "B"; resolved per turn from the chat id.
    tools: async ({ chatId }) => {
      const { pair } = await chatComparison(chatId);
      return comparisonTools(pair, chatModel()?.provider === "openai");
    },
    // Same monthly AI chat allowance as the property chat.
    onTurnStart: async ({ chatId }) => {
      const { comparison } = await chatComparison(chatId);
      const allowance = await getChatAllowance(comparison.userId);
      if (!allowance.allowed) throw new Error(chatRefusalMessage(allowance));
    },
    // Count each answered turn against the allowance (filed under report A).
    onTurnComplete: async ({ chatId, responseMessage, error }) => {
      if (error || !responseMessage) return;
      const { comparison } = await chatComparison(chatId);
      await recordChatMessage({
        messageId: responseMessage.id,
        userId: comparison.userId,
        reportId: comparison.reportAId,
      });
    },
    uiMessageStreamOptions: {
      sendSources: true,
      // Never send internals (keys, stacks) to the browser.
      onError: (error) => {
        console.error("[comparison-chat]", error);
        return "Something went wrong answering that. Try again.";
      },
    },
    run: async ({
      messages,
      chatId,
      clientData,
      tools,
      signal,
      streamText,
    }) => {
      const { comparison, pair } = await chatComparison(chatId);
      const picked = chatModel();
      if (!picked) {
        throw new Error(
          "AI isn't configured. Add OPENAI_API_KEY to the Trigger.dev environment.",
        );
      }
      const mode = parseTravelMode(clientData?.travelMode);
      return streamText({
        model: picked.model,
        instructions: comparisonInstructions(
          pair,
          mode,
          picked.provider === "openai",
        ),
        messages,
        tools,
        abortSignal: signal,
        // Comparing often needs a tool call per property: a few more steps.
        stopWhen: isStepCount(10),
        providerOptions: chatProviderOptions(
          picked.provider,
          `compare:${comparison.id}`,
        ),
      });
    },
  });
