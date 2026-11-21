-- AlterTable
ALTER TABLE "BillingAccount" ADD COLUMN     "extraReportCredits" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ExtraReportPurchase" (
    "checkoutSessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "amountSubtotal" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtraReportPurchase_pkey" PRIMARY KEY ("checkoutSessionId")
);

-- CreateIndex
CREATE INDEX "ExtraReportPurchase_userId_idx" ON "ExtraReportPurchase"("userId");

-- AddForeignKey
ALTER TABLE "ExtraReportPurchase" ADD CONSTRAINT "ExtraReportPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "BillingAccount"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
