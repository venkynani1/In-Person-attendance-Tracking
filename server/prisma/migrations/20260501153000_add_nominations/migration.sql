-- CreateTable
CREATE TABLE "Nomination" (
    "id" UUID NOT NULL,
    "trainingId" UUID NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Nomination_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Nomination_trainingId_employeeId_key" ON "Nomination"("trainingId", "employeeId");

-- AddForeignKey
ALTER TABLE "Nomination" ADD CONSTRAINT "Nomination_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "Training"("id") ON DELETE CASCADE ON UPDATE CASCADE;
