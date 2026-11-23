import type { Prisma } from "../generated/prisma/client";
import { JOB_KINDS } from "../lib/report-sections";
import { db } from "./db";
import type { ChatThread } from "./report-store";

/** A report this recent for the same address is reused, not made again. */
const REUSE_WINDOW_MS = 30 * 86_400_000;

const sideSelect = {
  id: true,
  name: true,
  inputAddress: true,
  property: {
    select: {
      formattedAddress: true,
      city: true,
      latitude: true,
      longitude: true,
      updatedAt: true,
    },
  },
} as const;

/**
 * Comparison chat ids carry the comparison id (`${comparisonId}.${suffix}`),
 * so access can be checked from the id, like report chats.
 */
export const newComparisonChatId = (comparisonId: string) =>
  `${comparisonId}.${crypto.randomUUID().slice(0, 8)}`;
export const comparisonIdOfChat = (chatId: string) =>
  chatId.split(".")[0] ?? "";

const emptyThread = (comparisonId: string): ChatThread => ({
  chatId: newComparisonChatId(comparisonId),
  entries: [],
  state: null,
});

export const comparisonStore = {
  /**
   * The agent's latest report for this address from the last 30 days, if
   * its address was found (a report whose lookup failed is made again).
   */
  async findReusableReport(
    userId: string,
    { address, placeId }: { address: string; placeId?: string },
  ) {
    return db.report.findFirst({
      where: {
        userId,
        createdAt: { gte: new Date(Date.now() - REUSE_WINDOW_MS) },
        OR: [
          ...(placeId ? [{ placeId }] : []),
          { inputAddress: { equals: address, mode: "insensitive" as const } },
          {
            property: {
              formattedAddress: { equals: address, mode: "insensitive" as const },
            },
          },
        ],
        jobs: { none: { kind: JOB_KINDS.identity, status: "failed" } },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  /**
   * Creates the comparison unless the agent made the same one within
   * `windowMs` (a double submit), in which case it returns that one.
   */
  async createUnlessRecent(
    input: { userId: string; reportAId: string; reportBId: string },
    windowMs = 60_000,
  ) {
    const recent = await db.comparison.findFirst({
      where: {
        ...input,
        createdAt: { gte: new Date(Date.now() - windowMs) },
      },
      orderBy: { createdAt: "desc" },
    });
    return recent ?? db.comparison.create({ data: input });
  },

  async findForUser(id: string, userId: string) {
    return db.comparison.findFirst({
      where: { id, userId },
      select: {
        id: true,
        name: true,
        createdAt: true,
        reportAId: true,
        reportBId: true,
      },
    });
  },

  /** A comparison by id, without checking the owner (the chat agent). */
  async findById(id: string) {
    return db.comparison.findUnique({
      where: { id },
      select: { id: true, userId: true, reportAId: true, reportBId: true },
    });
  },

  /** The agent's comparisons, newest first, for the dashboard history. */
  async listForUser(userId: string, take = 100) {
    return db.comparison.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        name: true,
        createdAt: true,
        reportA: { select: sideSelect },
        reportB: { select: sideSelect },
      },
    });
  },

  /** Sets the agent's label; null goes back to showing "A vs B". */
  async renameForUser(id: string, userId: string, name: string | null) {
    const { count } = await db.comparison.updateMany({
      where: { id, userId },
      data: { name },
    });
    return count > 0;
  },

  /** Deletes the comparison only; both reports stay. */
  async deleteForUser(id: string, userId: string) {
    const { count } = await db.comparison.deleteMany({ where: { id, userId } });
    return count > 0;
  },
  /** The comparison's current chat thread, or null before the first one. */
  async getChatThread(comparisonId: string): Promise<ChatThread | null> {
    const row = await db.comparison.findUnique({
      where: { id: comparisonId },
      select: { chat: true },
    });
    return (row?.chat as ChatThread | null | undefined) ?? null;
  },

  async saveChatThread(comparisonId: string, thread: ChatThread) {
    await db.comparison.update({
      where: { id: comparisonId },
      data: { chat: thread as unknown as Prisma.InputJsonValue },
    });
  },

  /** The current thread, creating an empty one (with a chat id) if needed. */
  async ensureChatThread(comparisonId: string): Promise<ChatThread> {
    const existing = await this.getChatThread(comparisonId);
    if (existing) return existing;
    const thread = emptyThread(comparisonId);
    await this.saveChatThread(comparisonId, thread);
    return thread;
  },

  /** Starts over: a fresh, empty thread under a new chat id. */
  async resetChatThread(comparisonId: string): Promise<ChatThread> {
    const thread = emptyThread(comparisonId);
    await this.saveChatThread(comparisonId, thread);
    return thread;
  },
};
