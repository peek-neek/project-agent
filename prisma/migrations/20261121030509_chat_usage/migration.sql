-- CreateTable
CREATE TABLE "ChatMessageUsage" (
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessageUsage_pkey" PRIMARY KEY ("messageId")
);

-- CreateIndex
CREATE INDEX "ChatMessageUsage_userId_createdAt_idx" ON "ChatMessageUsage"("userId", "createdAt");
