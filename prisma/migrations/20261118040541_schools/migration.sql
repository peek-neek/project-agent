-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "boardName" TEXT NOT NULL,
    "boardWebsite" TEXT,
    "type" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "gradeRange" TEXT,
    "street" TEXT,
    "city" TEXT,
    "postalCode" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "enrolment" INTEGER,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "g3Reading" INTEGER,
    "g3Writing" INTEGER,
    "g3Math" INTEGER,
    "g6Reading" INTEGER,
    "g6Writing" INTEGER,
    "g6Math" INTEGER,
    "g9Math" INTEGER,
    "osslt" INTEGER,
    "dataYear" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "School_latitude_longitude_idx" ON "School"("latitude", "longitude");
