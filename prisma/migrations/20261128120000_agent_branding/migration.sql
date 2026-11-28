-- CreateTable
CREATE TABLE "AgentBranding" (
    "userId" TEXT NOT NULL,
    "name" TEXT,
    "title" TEXT,
    "brokerage" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "logoPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentBranding_pkey" PRIMARY KEY ("userId")
);
