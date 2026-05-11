-- Make parent trainings session-aware while preserving existing single-day data.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE "Training" ADD COLUMN IF NOT EXISTS "trainingType" TEXT NOT NULL DEFAULT 'SINGLE';
ALTER TABLE "Training" ADD COLUMN IF NOT EXISTS "numberOfDays" INTEGER;
ALTER TABLE "Training" ALTER COLUMN "token" DROP NOT NULL;

CREATE TABLE IF NOT EXISTS "TrainingSession" (
  "id" UUID NOT NULL,
  "trainingId" UUID NOT NULL,
  "sessionDate" TIMESTAMP(3) NOT NULL,
  "startDateTime" TIMESTAMP(3) NOT NULL,
  "endDateTime" TIMESTAMP(3) NOT NULL,
  "dayNumber" INTEGER NOT NULL,
  "token" TEXT NOT NULL,
  "attendanceOpenedAt" TIMESTAMP(3),
  "manuallyStopped" BOOLEAN NOT NULL DEFAULT false,
  "stoppedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TrainingSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TrainingSession_token_key" ON "TrainingSession"("token");
CREATE INDEX IF NOT EXISTS "TrainingSession_trainingId_idx" ON "TrainingSession"("trainingId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'TrainingSession_trainingId_fkey'
  ) THEN
    ALTER TABLE "TrainingSession"
    ADD CONSTRAINT "TrainingSession_trainingId_fkey"
    FOREIGN KEY ("trainingId") REFERENCES "Training"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "TrainingSession" (
  "id",
  "trainingId",
  "sessionDate",
  "startDateTime",
  "endDateTime",
  "dayNumber",
  "token",
  "attendanceOpenedAt",
  "manuallyStopped",
  "stoppedAt",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid(),
  t."id",
  date_trunc('day', t."startDateTime"),
  t."startDateTime",
  t."endDateTime",
  1,
  COALESCE(t."token", encode(gen_random_bytes(32), 'hex')),
  t."attendanceOpenedAt",
  t."manuallyStopped",
  t."stoppedAt",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Training" t
WHERE NOT EXISTS (
  SELECT 1 FROM "TrainingSession" s WHERE s."trainingId" = t."id"
);

ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "sessionId" UUID;

UPDATE "Attendance" a
SET "sessionId" = s."id"
FROM "TrainingSession" s
WHERE a."trainingId" = s."trainingId"
  AND s."dayNumber" = 1
  AND a."sessionId" IS NULL;

DROP INDEX IF EXISTS "Attendance_trainingId_employeeId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Attendance_trainingId_sessionId_employeeId_key"
ON "Attendance"("trainingId", "sessionId", "employeeId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Attendance_sessionId_fkey'
  ) THEN
    ALTER TABLE "Attendance"
    ADD CONSTRAINT "Attendance_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
