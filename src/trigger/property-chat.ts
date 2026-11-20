import { chat } from "@trigger.dev/sdk/ai";
import { isStepCount } from "ai";
import { z } from "zod";
import { parseTravelMode } from "../lib/travel";
import { propertyChatStorage } from "../server/ai/chat-storage";
import {
  chatInstructions,
  chatModel,
  chatProviderOptions,
  chatTools,
  webSearchTool,
} from "../server/ai/property-chat";
import { calculatorTools, financeContext } from "../server/ai/calculator-tools";
import { reportIdOfChat, reportStore } from "../server/report-store";

/** The report a chat belongs to (chat ids carry it). Fresh every turn. */
async function chatReport(chatId: string) {
  const report = await reportStore.findWithDetails(reportIdOfChat(chatId));
  if (!report) throw new Error("This chat's report no longer exists.");
  return report;
}

/**
 * The property chat as a durable agent: each conversation is one long-lived
 * run, so an answer keeps going if the tab closes, and a reload reconnects
 * to the live stream. History is saved to the report (propertyChatStorage).
 */
export const propertyChat = chat
  .withClientData({
    // The agent's walk / bike / car choice, sent with every message.
    schema: z.object({
      travelMode: z.enum(["walk", "bike", "drive"]).optional(),
    }),
  })
  .agent({
    id: "property-chat",
    storage: propertyChatStorage,
    // Places and routes are around this chat's property; calculators use its
    // list price and the agent's saved figures; web search needs OpenAI.
    // Resolved per turn from the chat id.
    tools: async ({ chatId }) => {
      const report = await chatReport(chatId);
      const lat = report.property?.latitude;
      const lng = report.property?.longitude;
      return {
        ...(lat != null && lng != null ? chatTools({ lat, lng }) : {}),
        ...calculatorTools(financeContext(report)),
        ...(chatModel()?.provider === "openai"
          ? { web_search: webSearchTool(report.property?.city) }
          : {}),
      };
    },
    uiMessageStreamOptions: {
      sendSources: true,
      // Never send internals (keys, stacks) to the browser.
      onError: (error) => {
        console.error("[property-chat]", error);
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
      const report = await chatReport(chatId);
      const picked = chatModel();
      if (!picked) {
        throw new Error(
          "AI isn't configured. Add OPENAI_API_KEY to the Trigger.dev environment.",
        );
      }
      const mode = parseTravelMode(clientData?.travelMode);
      return streamText({
        model: picked.model,
        instructions: chatInstructions(
          report,
          mode,
          picked.provider === "openai",
        ),
        messages,
        tools,
        abortSignal: signal,
        stopWhen: isStepCount(6),
        providerOptions: chatProviderOptions(picked.provider, report.id),
      });
    },
  });
