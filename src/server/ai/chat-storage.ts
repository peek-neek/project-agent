// Transcript storage for the chat agents: each conversation lives with what
// it's about (a report's "chat" section, or the comparison's chat column),
// so our database stays the source of truth (the chat pages prefetch it on
// the server). Used by the chat.agent tasks.
import type { TranscriptStorage } from "@trigger.dev/sdk/ai";
import type { UIMessage } from "ai";
import { comparisonIdOfChat, comparisonStore } from "../comparison-store";
import { type ChatThread, reportIdOfChat, reportStore } from "../report-store";

/**
 * Storage over one owner's current thread. `ownerOf` reads the owner id
 * (report or comparison) from the chat id.
 */
function threadStorage(store: {
  ownerOf: (chatId: string) => string;
  get: (ownerId: string) => Promise<ChatThread | null>;
  save: (ownerId: string, thread: ChatThread) => Promise<unknown>;
}): TranscriptStorage {
  return {
    async load({ chatId }) {
      const thread = await store.get(store.ownerOf(chatId));
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
      const ownerId = store.ownerOf(chatId);
      const thread = await store.get(ownerId);
      // Ignore late saves from a thread the agent has since replaced.
      if (thread && thread.chatId !== chatId) return;
      await store.save(ownerId, {
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
}

/** The property chat: the thread is saved in the report. */
export const propertyChatStorage = threadStorage({
  ownerOf: reportIdOfChat,
  get: (id) => reportStore.getChatThread(id),
  save: (id, thread) => reportStore.saveChatThread(id, thread),
});

/** The comparison chat: the thread is saved on the comparison. */
export const comparisonChatStorage = threadStorage({
  ownerOf: comparisonIdOfChat,
  get: (id) => comparisonStore.getChatThread(id),
  save: (id, thread) => comparisonStore.saveChatThread(id, thread),
});
