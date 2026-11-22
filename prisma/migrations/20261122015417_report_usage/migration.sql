-- CreateTable
CREATE TABLE "ReportUsage" (
    "reportId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "usedCredit" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportUsage_pkey" PRIMARY KEY ("reportId")
);

-- CreateIndex
CREATE INDEX "ReportUsage_userId_createdAt_idx" ON "ReportUsage"("userId", "createdAt");

-- Backfill: every existing report counts toward its month's allowance.
INSERT INTO "ReportUsage" ("reportId", "userId", "createdAt")
SELECT "id", "userId", "createdAt" FROM "Report"
ON CONFLICT DO NOTHING;
