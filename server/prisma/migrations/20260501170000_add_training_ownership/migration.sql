-- Add nullable ownership for existing legacy trainings.
-- New trainings must set createdById at the application layer.
ALTER TABLE "Training" ADD COLUMN IF NOT EXISTS "createdById" UUID;

CREATE INDEX IF NOT EXISTS "Training_createdById_idx" ON "Training"("createdById");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Training_createdById_fkey'
  ) THEN
    ALTER TABLE "Training"
    ADD CONSTRAINT "Training_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
