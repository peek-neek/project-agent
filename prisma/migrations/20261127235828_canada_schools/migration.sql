-- CreateTable
CREATE TABLE "CanadaSchool" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "boardName" TEXT,
    "type" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "elementary" BOOLEAN NOT NULL,
    "secondary" BOOLEAN NOT NULL,
    "street" TEXT,
    "city" TEXT,
    "province" TEXT NOT NULL,
    "postalCode" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "geocoded" BOOLEAN NOT NULL DEFAULT false,
    "approximate" BOOLEAN NOT NULL DEFAULT false,
    "dataYear" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanadaSchool_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CanadaSchool_latitude_longitude_idx" ON "CanadaSchool"("latitude", "longitude");
