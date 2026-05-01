ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "resetToken" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "resetTokenExpires" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "users_resetToken_key" ON "users"("resetToken");
