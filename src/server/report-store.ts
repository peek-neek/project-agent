// Shared by Next.js and Trigger.dev tasks, so no "server-only" import here.
import type { Prisma } from "../generated/prisma/client";
import { JOB_KINDS } from "../lib/report-sections";
import { db } from "./db";

export const reportModes = ["single", "compare", "bulk"] as const;
export type ReportMode = (typeof reportModes)[number];

export const PROPERTY_IDENTITY_JOB = JOB_KINDS.identity;

export type FieldSource = "search" | "google" | "agent";
export type FieldProvenance = { source: FieldSource; asOf: string };
export type IdentitySources = Partial<
  Record<
    | "formattedAddress"
    | "unitNumber"
    | "legalDescription"
    | "pin"
    | "rollNumber",
    FieldProvenance
  >
>;

/** Section holding the property chat thread (kept out of the report). */
export const CHAT_SECTION = "chat";

/** A saved chat: the AI SDK UI messages plus what the runtime resumes from. */
export type ChatThread = {
  /** Trigger.dev chat session id: `${reportId}.${suffix}`. */
  chatId: string;
  entries: { id: string; final: boolean; message: unknown }[];
  /** The chat runtime's opaque state (compaction etc.). */
  state: unknown | null;
  cursors?: { lastOutEventId?: string; lastInEventId?: string };
};

/** Chat ids carry their report id, so access can be checked from the id. */
export const newChatId = (reportId: string) =>
  `${reportId}.${crypto.randomUUID().slice(0, 8)}`;
export const reportIdOfChat = (chatId: string) => chatId.split(".")[0] ?? "";

const reportInclude = {
  property: true,
  jobs: { orderBy: { createdAt: "asc" } },
  // The chat history can grow long; it's loaded on its own (getChat).
  sections: { where: { key: { not: CHAT_SECTION } } },
} satisfies Prisma.ReportInclude;

export type ReportWithDetails = Prisma.ReportGetPayload<{
  include: typeof reportInclude;
}>;

export const reportStore = {
  async create(input: {
    userId: string;
    address: string;
    mode: ReportMode;
    placeId?: string;
  }) {
    return db.report.create({
      data: {
        userId: input.userId,
        inputAddress: input.address,
        mode: input.mode,
        placeId: input.placeId,
        jobs: {
          create: Object.values(JOB_KINDS).map((kind) => ({ kind })),
        },
      },
    });
  },

  async findForUser(id: string, userId: string) {
    return db.report.findFirst({
      where: { id, userId },
      include: reportInclude,
    });
  },

  /** The agent's reports, newest first, for the dashboard history. */
  async listForUser(userId: string, take = 100) {
    return db.report.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        name: true,
        inputAddress: true,
        mode: true,
        createdAt: true,
        property: { select: { formattedAddress: true, city: true } },
      },
    });
  },

  /** Sets the agent's label; null goes back to showing the address. */
  async renameForUser(id: string, userId: string, name: string | null) {
    const { count } = await db.report.updateMany({
      where: { id, userId },
      data: { name },
    });
    return count > 0;
  },

  /** Deletes a report (jobs and sections cascade). Returns false if not found. */
  async deleteForUser(id: string, userId: string) {
    const { count } = await db.report.deleteMany({ where: { id, userId } });
    return count > 0;
  },

  async findById(id: string) {
    return db.report.findUnique({ where: { id } });
  },

  /** Report with identity and sections, for extractors (no ownership check). */
  async findWithDetails(id: string) {
    return db.report.findUnique({ where: { id }, include: reportInclude });
  },

  async getSection(reportId: string, key: string) {
    const row = await db.reportSection.findUnique({
      where: { reportId_key: { reportId, key } },
    });
    return row?.data ?? null;
  },

  /**
   * The report's current chat thread: its chat id (a Trigger.dev chat
   * session), the saved transcript and the runtime's resume cursors. Older
   * chats (a plain message array) are converted on read.
   */
  async getChatThread(reportId: string): Promise<ChatThread | null> {
    const row = await db.reportSection.findUnique({
      where: { reportId_key: { reportId, key: CHAT_SECTION } },
    });
    const data = row?.data as unknown;
    if (!data) return null;
    if (Array.isArray(data)) {
      return {
        chatId: newChatId(reportId),
        entries: (data as { id: string }[]).map((message) => ({
          id: message.id,
          final: true,
          message,
        })),
        state: null,
      };
    }
    return data as ChatThread;
  },

  async saveChatThread(reportId: string, thread: ChatThread) {
    return this.setSection(
      reportId,
      CHAT_SECTION,
      thread as unknown as Prisma.InputJsonValue,
    );
  },

  /** The current thread, creating an empty one (with a chat id) if needed. */
  async ensureChatThread(reportId: string): Promise<ChatThread> {
    const existing = await this.getChatThread(reportId);
    if (existing) return existing;
    const thread: ChatThread = {
      chatId: newChatId(reportId),
      entries: [],
      state: null,
    };
    await this.saveChatThread(reportId, thread);
    return thread;
  },

  /** Starts over: a fresh, empty thread under a new chat id. */
  async resetChatThread(reportId: string): Promise<ChatThread> {
    const thread: ChatThread = {
      chatId: newChatId(reportId),
      entries: [],
      state: null,
    };
    await this.saveChatThread(reportId, thread);
    return thread;
  },

  async setSection(reportId: string, key: string, data: Prisma.InputJsonValue) {
    return db.reportSection.upsert({
      where: { reportId_key: { reportId, key } },
      create: { reportId, key, data },
      update: { data },
    });
  },

  /** Creates the job row when missing (reports made before a step existed). */
  async updateJob(
    reportId: string,
    kind: string,
    data: Omit<
      Prisma.ReportJobUncheckedCreateInput,
      "id" | "reportId" | "kind"
    >,
  ) {
    return db.reportJob.upsert({
      where: { reportId_kind: { reportId, kind } },
      create: { reportId, kind, ...data },
      update: data,
    });
  },

  /** Writes identity fields and merges their provenance into `sources`. */
  async saveIdentity(
    reportId: string,
    fields: Omit<
      Prisma.PropertyIdentityUncheckedCreateInput,
      "reportId" | "sources" | "updatedAt"
    >,
    sources: IdentitySources,
  ) {
    const existing = await db.propertyIdentity.findUnique({
      where: { reportId },
      select: { sources: true },
    });
    const merged = {
      ...((existing?.sources as IdentitySources | null) ?? {}),
      ...sources,
    };
    return db.propertyIdentity.upsert({
      where: { reportId },
      create: { reportId, ...fields, sources: merged },
      update: { ...fields, sources: merged },
    });
  },
};
