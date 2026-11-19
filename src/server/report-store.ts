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

const reportInclude = {
  property: true,
  jobs: { orderBy: { createdAt: "asc" } },
  sections: true,
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
