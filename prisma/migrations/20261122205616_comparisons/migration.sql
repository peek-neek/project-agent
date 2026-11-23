-- CreateTable
CREATE TABLE "Comparison" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reportAId" TEXT NOT NULL,
    "reportBId" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comparison_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Comparison_userId_createdAt_idx" ON "Comparison"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Comparison_reportAId_idx" ON "Comparison"("reportAId");

-- CreateIndex
CREATE INDEX "Comparison_reportBId_idx" ON "Comparison"("reportBId");

-- AddForeignKey
ALTER TABLE "Comparison" ADD CONSTRAINT "Comparison_reportAId_fkey" FOREIGN KEY ("reportAId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comparison" ADD CONSTRAINT "Comparison_reportBId_fkey" FOREIGN KEY ("reportBId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
