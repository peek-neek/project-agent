-- CreateTable
CREATE TABLE "InfrastructureProject" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "targetCompletion" TEXT,
    "community" TEXT,
    "address" TEXT,
    "transitLine" TEXT,
    "budget" DOUBLE PRECISION,
    "website" TEXT,
    "description" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InfrastructureProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DevelopmentApplication" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "address" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT,
    "units" INTEGER,
    "storeys" INTEGER,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DevelopmentApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InfrastructureProject_latitude_longitude_idx" ON "InfrastructureProject"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "DevelopmentApplication_latitude_longitude_idx" ON "DevelopmentApplication"("latitude", "longitude");
