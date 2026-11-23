"use server";

import { auth as clerkAuth } from "@clerk/nextjs/server";
import { auth } from "@trigger.dev/sdk";
import { chat } from "@trigger.dev/sdk/ai";
import type { comparisonChat } from "@/trigger/comparison-chat";
import type { propertyChat } from "@/trigger/property-chat";
import {
  comparisonIdOfChat,
  comparisonStore,
} from "@/server/comparison-store";
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

// --- Comparison chat: the same, checked against the comparison's owner. ---

async function assertOwnsComparison(comparisonId: string) {
  const { userId } = await clerkAuth();
  if (!userId) throw new Error("Sign in to chat.");
  const comparison = await comparisonStore.findForUser(comparisonId, userId);
  if (!comparison) throw new Error("Comparison not found.");
  return comparison;
}

/** Only the comparison's current thread may be used. */
async function assertOwnsComparisonChat(chatId: string) {
  const comparison = await assertOwnsComparison(comparisonIdOfChat(chatId));
  const thread = await comparisonStore.getChatThread(comparison.id);
  if (thread?.chatId !== chatId) throw new Error("This chat has ended.");
}

const startComparisonSession =
  chat.createStartSessionAction<typeof comparisonChat>("comparison-chat");

/** Creates the comparison chat's session and first run. */
export async function startComparisonChat(
  params: Parameters<typeof startComparisonSession>[0],
) {
  await assertOwnsComparisonChat(params.chatId);
  return startComparisonSession(params);
}

/** Refreshes the comparison chat's session token. */
export async function mintComparisonChatToken(chatId: string) {
  await assertOwnsComparisonChat(chatId);
  return auth.createPublicToken({
    scopes: { read: { sessions: chatId }, write: { sessions: chatId } },
    expirationTime: "1h",
  });
}

/** Starts a fresh conversation for a comparison; returns its chat id. */
export async function newComparisonChat(comparisonId: string) {
  await assertOwnsComparison(comparisonId);
  const thread = await comparisonStore.resetChatThread(comparisonId);
  return thread.chatId;
}
