-- CreateTable
CREATE TABLE "FederalProject" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "program" TEXT,
    "status" TEXT NOT NULL,
    "targetCompletion" TEXT,
    "municipalities" TEXT NOT NULL,
    "municipalityKeys" TEXT[],
    "province" TEXT NOT NULL,
    "federalContribution" DOUBLE PRECISION,
    "totalCost" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FederalProject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FederalProject_province_idx" ON "FederalProject"("province");
