-- CreateTable
CREATE TABLE "Disease" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "category" TEXT NOT NULL DEFAULT 'unknown',

    CONSTRAINT "Disease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vaccine" (
    "id" SERIAL NOT NULL,
    "diseaseId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "doses" TEXT NOT NULL DEFAULT 'N/A',
    "coveragePercent" DOUBLE PRECISION,
    "region" TEXT,
    "introductionYear" INTEGER,

    CONSTRAINT "Vaccine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Disease_name_key" ON "Disease"("name");

-- AddForeignKey
ALTER TABLE "Vaccine" ADD CONSTRAINT "Vaccine_diseaseId_fkey" FOREIGN KEY ("diseaseId") REFERENCES "Disease"("id") ON DELETE CASCADE ON UPDATE CASCADE;

