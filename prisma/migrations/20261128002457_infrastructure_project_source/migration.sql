-- AlterTable
ALTER TABLE "InfrastructureProject" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'Ontario Builds';

-- CreateIndex
CREATE INDEX "InfrastructureProject_source_idx" ON "InfrastructureProject"("source");
