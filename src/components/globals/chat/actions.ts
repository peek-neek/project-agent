"use server";

import { auth as clerkAuth } from "@clerk/nextjs/server";
import { auth } from "@trigger.dev/sdk";
import { chat } from "@trigger.dev/sdk/ai";
import type { propertyChat } from "@/trigger/property-chat";
import { reportIdOfChat, reportStore } from "@/server/report-store";

// The browser never holds the Trigger.dev secret key: these actions start
// chat sessions and mint session-scoped tokens, after checking the signed-in
// agent owns the report the chat belongs to.

async function assertOwnsReport(reportId: string) {
  const { userId } = await clerkAuth();
  if (!userId) throw new Error("Sign in to chat.");
  const report = await reportStore.findForUser(reportId, userId);
  if (!report) throw new Error("Report not found.");
  return report;
}

/** Only the report's current thread may be used (not arbitrary ids). */
async function assertOwnsChat(chatId: string) {
  const report = await assertOwnsReport(reportIdOfChat(chatId));
  const thread = await reportStore.getChatThread(report.id);
  if (thread?.chatId !== chatId) throw new Error("This chat has ended.");
}

const startSession =
  chat.createStartSessionAction<typeof propertyChat>("property-chat");

/** Creates the chat's session and first run (idempotent per chat id). */
export async function startPropertyChat(
  params: Parameters<typeof startSession>[0],
) {
  await assertOwnsChat(params.chatId);
  return startSession(params);
}

/** Refreshes the session token (the transport calls this on 401/403). */
export async function mintPropertyChatToken(chatId: string) {
  await assertOwnsChat(chatId);
  return auth.createPublicToken({
    scopes: { read: { sessions: chatId }, write: { sessions: chatId } },
    expirationTime: "1h",
  });
}

/** Starts a fresh conversation for a report; returns its chat id. */
export async function newPropertyChat(reportId: string) {
  await assertOwnsReport(reportId);
  const thread = await reportStore.resetChatThread(reportId);
  return thread.chatId;
}
