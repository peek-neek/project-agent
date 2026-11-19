// Transcript storage for the property chat: the conversation lives in the
// report's "chat" section, so our database stays the source of truth (the
// chat page prefetches it on the server). Used by the chat.agent task.
import type { TranscriptStorage } from "@trigger.dev/sdk/ai";
import type { UIMessage } from "ai";
import { reportIdOfChat, reportStore } from "../report-store";

export const propertyChatStorage: TranscriptStorage = {
  async load({ chatId }) {
    const thread = await reportStore.getChatThread(reportIdOfChat(chatId));
    // Another thread replaced this one ("New chat"): it starts empty.
    if (!thread || thread.chatId !== chatId)
      return { messages: [], state: null };
    return {
      messages: thread.entries.map((e) => e.message as UIMessage) as never,
      state: thread.state,
      cursors: thread.cursors,
      nonFinalIds: thread.entries.filter((e) => !e.final).map((e) => e.id),
    };
  },

  async save({ chatId }, changeset) {
    const reportId = reportIdOfChat(chatId);
    const thread = await reportStore.getChatThread(reportId);
    // Ignore late saves from a thread the agent has since replaced.
    if (thread && thread.chatId !== chatId) return;
    await reportStore.saveChatThread(reportId, {
      chatId,
      entries: changeset.transcript.entries.map((e) => ({
        id: e.id,
        final: e.final,
        message: e.message,
      })),
      state: changeset.transcript.state,
      cursors: changeset.cursors ?? thread?.cursors,
    });
  },
};
